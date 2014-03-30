ext =
  jpeg: ["jpeg", "jpg"]
  image: ["jpeg", "jpg", "bmp", "tiff", "tif",  "png", "gif"]
  video: ["mp4", "ogg", "webm"]
pad0 = (num, len = 2)->
  _.last("0" + num, len).join ""
convertFileData = (line)->
  d = line.split ","
  l = d.length
  r_uri = d[0]
  fname = d.slice(1, l-4).join(",")
  fsize = Number d[l-4]
  fattr = Number d[l-3]
  fdate = Number d[l-2]
  ftime = Number d[l-1]
  fext = _.last(fname.split(".")).toLowerCase()
  isImage =  _.include ext.image, fext
  isVideo =  _.include ext.video, fext
  isJPEG  =  _.include ext.jpeg, fext
  src =  "#{r_uri}/#{fname}"
  year = ((fdate & 0xfc00) >> 9) + 1980
  month = (fdate & 0x00e0) >> 5
  day = (fdate & 0x001f)
  hour = (ftime & 0xf800) >> 11
  min = (ftime & 0x07e0) >> 5
  sec = (ftime & 0x001f)

  id: src
  r_uri: r_uri
  fname: fname
  fsize: fsize
  fattr: fattr
  fdate: fdate
  ftime: ftime
  fext:  fext
  isHidden: !!(fattr & 0x02)
  year: year
  month: month
  day: day
  hour: hour
  min: min
  sec: sec
  src: src
  isDir: !!(fattr & 0x10)
  isImage: isImage
  isVideo: isVideo
  isJPEG:  isJPEG
  isPicture: isImage || isVideo
  href: "#picture/#{src}"
  thumbnail: if isJPEG then "/thumbnail.cgi?#{src}" else src
  date: "#{year}/#{month}/#{day}"
  time: "#{pad0 hour}:#{pad0 min}:#{pad0 sec}"
  title: fname

class Params extends Backbone.Model
  defaults:
    year: null
    month: null
    day: null
    time: null
  type: ->
    json = @toJSON()
    if json.year && json.month && json.day
      "pictures"
    else if json.year && json.month
      "days"
    else if json.year
      "months"
    else
      "years"

class DateItem extends Backbone.Model
  ###
  id: "2014" or "2014/10" or "2014/10/10"
  picture:
  type: "Year" "Month" "Day"
  ###
  resetCount: ->
    @set "count", 0

  addCount: ->
    @set "count", (@get("count") || 0)+1

  getPicture: (type)->
    picture = @get("picture").toJSON()
    switch type
      when "year"
        picture.href = "#timeline/#{picture.year}"
        picture.title = picture.year
        picture.count = @get "count"
      when "month"
        picture.href = "#timeline/#{picture.year}/#{picture.month}"
        picture.title = picture.month
        picture.title = "#{picture.year}/#{picture.month}"
        picture.count = @get "count"
      when "day"
        picture.href = "#timeline/#{picture.year}/#{picture.month}/#{picture.day}"
        picture.title = picture.day
        picture.title = "#{picture.year}/#{picture.month}/#{picture.day}"
        picture.count = @get "count"
    picture

class DateCollection extends Backbone.Collection
  model: DateItem
  isCompleted: false

  addPicture: (picture)->
    return unless picture.get("isVideo") || picture.get("isImage")
    year =  picture.get("year")
    month = picture.get("month")
    day =   picture.get("day")
    yearId =  year
    monthId = [year, month].join "/"
    dayId =   [year, month, day].join "/"

    @upsertItem
      id: year
      type: "year"
      year: year
      picture: picture

    @upsertItem
      id: month
      type: "month"
      year: year
      month: month
      picture: picture

    @upsertItem
      id: day
      type: "day"
      year: year
      month: month
      day: day
      picture: picture

  upsertItem: (attr)->
    @set [attr],
      remove: false
    @get(attr.id).addCount()

  getPictures2: (attr)->
    _.invoke @where(attr), "getPicture", attr.type

  getPictures: (attr)->
    _(@where(attr)).invoke "getPicture", attr.type
    .sortBy (item)->
      item[attr.type]
    .valueOf()

  syncPictures: (pictures)->
    @invoke "resetCount"
    pictures.each (picture)=>
      @addPicture picture
    @trigger "update:pictures"

class Picture extends Backbone.Model
  defaults:
    title: ""
    count: ""

class PicturesCollection extends Backbone.Collection
  model: Picture
  url: "/command.cgi"
  parse: (resp)->
    lines = _(resp.split(/\r\n|\r|\n/)).rest().initial().valueOf()

    resp.results =  _(lines).map(convertFileData)
    .reject (file)->
      file.isHidden || (file.isHiddenRoot)
    .valueOf()

  getSubDir: ->
    defer = $.Deferred()
    dirs = @where isDir: true
    if _.isEmpty dirs
      defer.resolve()
    else
      @remove dirs, silent: true
      $.when.apply null, _.map dirs, (dir)=>
        @getFiles(dir.get "src")
        .then =>
          @getSubDir()
        .then =>
          defer.resolve()
    defer

  # getFiles: (path = "/DCIM")->
  getFiles: (path = "/")->
    @fetch
      remove: false
      dataType: "text"
      data:
        op: 100
        DIR: path

  startMonitoring: (immediate = false)->
    defer = $.Deferred()
    if immediate
      defer.resolve()
    else
      _.delay defer.resolve , 10 * 1000
    defer.then =>
      @remoteIsUpdated()
    .then =>
      @update()
    .always =>
      @startMonitoring()

  remoteIsUpdated: ->
    defer = $.Deferred()
    $.ajax
      url: "/command.cgi"
      data:
        op: 102
    .then (res)->
      if $.trim(res) == "1"
        defer.resolve()
      else
        defer.reject()
    , defer.reject
    defer

  update: ->
    defer = $.Deferred()
    @getFiles()
    .then =>
      @getSubDir()
    .then =>
      defer.resolve()
      @trigger "update:completed"
    defer

class PictureRouter extends Backbone.Router
  initialize: ->
    @params = new Params
    @pictures = new PicturesCollection
    @dateItems = new DateCollection
    window.pict = @pictures
    window.di = @dateItems

    @listenTo @pictures, "sync", @syncPictures
    @listenToOnce @pictures, "update:completed", =>
      @stopListening @pictures, "sync", @syncPictures
      @listenTo @pictures, "update:completed", @syncPictures

    @pictures.update().then =>
      @pictures.startMonitoring()

    @headerView = new HeaderView
      el: "#header"
      params:     @params
    @headerView.render()

    @timelineView = new TimelineView
      el: "#timeline"
      collection: @pictures
      params:     @params
      dateItems:  @dateItems
    @timelineView.render()

    @pictureView = new PictureView
      el: "#picture"
      collection: @pictures
      params:     @params

    @pictureView.render()

    super

  syncPictures: ->
    _.delay =>
      @dateItems.syncPictures @pictures
    ,100

  routes:
    "timeline": "timeline"
    "timeline/:year": "timeline"
    "timeline/:year/:month": "timeline"
    "timeline/:year/:month/:day": "timeline"
    "picture/*path": "picture"
    ".*": "defaultRoute"

  timeline: (year, month, day)->
    @headerView.show()
    @timelineView.show()
    @pictureView.hide()
    @params.set
      year: Number year
      month: Number month
      day: Number day
      time: null

  picture: (path)->
    @headerView.show()
    @timelineView.hide()
    @pictureView.setPath path
    @pictureView.show()

  defaultRoute: ->
    @navigate "timeline",
      trigger: true
      replace: true


class View extends Backbone.View
  render: ->
    @$el.html @template()

  show: ->
    @$el.removeClass "hidden"

  hide: ->
    @$el.addClass "hidden"

class HeaderView extends View
  template: _.template """
<div class="container-fluid">
  <div class="navbar-header">
    <ul class="nav nav-pills">
  <% if(year){ %>
    <% if(time){ %>
      <li>
        <a href="#timeline/<%- year %>/<%- month %>/<%- day %>">
          <span class="glyphicon glyphicon-calendar"></span> <%- year %>/<%- month %>/<%- day %>
        </a>
      </li>
      <li class="disabled"><a>/</a></li>
      <li class="active"><a><span class="glyphicon glyphicon-time"></span> <%- time %></a></li>
    <% }else if(day){ %>
      <li><a href="#timeline">Top</a></li>
      <li><a href="#timeline/<%- year %>"><%- year %></a></li>
      <li class="disabled"><a>/</a></li>
      <li><a href="#timeline/<%- year %>/<%- month %>"><%- month %></a></li>
      <li class="disabled"><a>/</a></li>
      <li class="active"><a href="#timeline/<%- year %>/<%- month %>/<%- day %>"><%- day %></a></li>
    <% }else if(month){ %>
      <li><a href="#timeline">Top</a></li>
      <li><a href="#timeline/<%- year %>"><%- year %></a></li>
      <li class="disabled"><a>/</a></li>
      <li class="active"><a href="#timeline/<%- year %>/<%- month %>"><%- month %></a></li>
    <% }else{ %>
      <li><a href="#timeline">Top</a></li>
      <li class="active"><a href="#timeline/<%- year %>"><%- year %></a></li>
    <%}%>
  <% }else{ %>
      <li class="active"><a href="#timeline">Top</a></li>
  <%}%>
    </ul>
  </div>
</div>
  """
  initialize: (options)->
    @params = options?.params
    @listenTo @params, "change", @render
    super
  render: ->
    @$el.html @template @params.toJSON()
###


###
class TimelineView extends View
  template_x: _.template """
<div class="row board"></div>
  """
  template: _.template """
<ul class="board"></ul>
  """

  itemsTemplate: _.template """
<% _.each(items, function(item){%>
  <li class="picture">
    <a href="<%- item.href %>" class="thumbnail">
    <% if(item.isImage) { %>
      <img class="lazy" data-original="<%- item.thumbnail %>" alt="" />
    <%}else if(item.isVideo){ %>
      <video src="<%- item.src %>" ></video>
    <%}else { %>
      <span class="label label-info"><%- item.fext %></span>
    <%} %>
    <% if(item.count){ %>
      <div class="caption"><span class="memo"><%- item.title %></span> <span class="badge pull-right"><%- item.count %></span> </div>
    <%}else{%>
      <div class="caption filename"><span class="memo"><%- item.title %></span></div>
    <%}%>
    </a>
  </li>
<%});%>
  """
  itemsTemplate_x: _.template """

<% _.each(items, function(item){%>
  <div class="col-xs-6 col-sm-3">
  <% if(item.title){%>
    <div>
      <span class="label label-info"><%- item.title %></span>
    </div>
  <%}%>
    <a href="<%- item.href %>" class="thumbnail">
    <% if(item.isImage) { %>
      <img class="lazy" data-original="<%- item.thumbnail %>" alt="">
    <%}else if(item.isVideo){ %>
      <video src="<%- item.src %>" >
    <%}else { %>
      <span class="label label-info"><%- item.fext %></span>
    <%} %>
    </a>
  </div>
<%});%>
  """
  initialize: (options)->
    super
    @pictures = options?.pictures
    @params = options?.params
    @dateItems = options?.dateItems
    @listenTo @dateItems, "update:pictures", @itemsRender
    @listenTo @params, "change", @itemsRender

  itemsRender: ->
    switch @params.type()
      when "years"
        items = @dateItems.getPictures
          type: "year"
      when "months"
        items = @dateItems.getPictures
          type: "month"
          year: @params.get "year"
      when "days"
        items = @dateItems.getPictures
          type: "day"
          year: @params.get "year"
          month: @params.get "month"
      else

        items = @collection.where
          year:  @params.get "year"
          month: @params.get "month"
          day:   @params.get "day"

        items = _.invoke items, "toJSON"

    @$(".board").html @itemsTemplate items: items
    @$(".thumbnail video").each ->
      $video = $(@)
      $video.height($video.width()*0.75) if $video.height() == 150

    @$("img.lazy").lazyload effect: "fadeIn"


class PictureView extends View
  template: _.template """
  <div class="well picture-loading">
    <h1>Loading ...</h1>
  </div>
  """
  imgTemplate: _.template """
<img class="img-thumbnail" src="<%- src %>"/>
<div class="exif-info fade">
  <div class="row">
    <div class="col-xs-12 col-md-8 col-md-offset-2">
      <div class="row exif-list">
      </div>
    </div>
  </div>
</div>
  """
  exifTemplate: _.template """
  <div class="col-xs-4 text-right"><span class="glyphicon glyphicon-picture"></span> :</div>
  <div class="col-xs-8 text-left"><%- picture.fname %></div>
<% _.each(exif, function(value, key){%>
  <div class="col-xs-4 text-right"><strong><%- key %></strong> :</div>
  <div class="col-xs-8 text-left"><%- value %> </div>
<%}) %>
  """
  videoTemplate: _.template """
<video class="img-thumbnail" src="<%- src %>" controls ></video>
  """

  initialize: (options)->
    @params = options?.params
    super

  show: ->
    $("body").addClass "full-screen"
    super
  hide: ->
    super
    $("body").removeClass "full-screen"

  getPicture: (path)->
    defer = $.Deferred()
    picture = @collection.get path
    if picture
      defer.resolve picture
    else
      @collection.once "sync", =>
        @getPicture(path).then defer.resolve
    defer
  events:
    "click img": "toggleEXIF"

  toggleEXIF: ->
    if @$(".exif-info").hasClass "in"
      @$(".exif-info").removeClass "in"
    else
      img = @$("img").get 0
      EXIF.getData img, =>
        exif = _.pick EXIF.getAllTags(img), [
          "ImageDescription"
          "Make"
          "Model"
          "FNumber"
          "ISOSpeedRatings"
          "Flash"
          "PixelXDimension"
          "PixelYDimension"
          "WhiteBalance"
        ]
        exif.Maker = exif.ImageDescription || exif.Make
        exif.ISO = exif.ISOSpeedRatings
        exif.Size = "#{exif.PixelXDimension} x #{exif.PixelYDimension}"
        exif["F"] = exif.FNumber
        exif["W/B"] = exif.WhiteBalance

        delete exif.ImageDescription
        delete exif.Make
        delete exif.ISOSpeedRatings
        delete exif.PixelXDimension
        delete exif.PixelYDimension
        delete exif.FNumber
        delete exif.WhiteBalance

        @$(".exif-list").html @exifTemplate
          exif: exif
          picture: @picture.toJSON()

        @$(".exif-info").addClass "in"

  setPath: (path)->
    @getPicture(path).then (picture)=>
      json = picture.toJSON()
      @picture = picture
      @params.set
        year: Number json.year
        month: Number json.month
        day: Number json.day
        time: json.time

      if json.isImage
        @$el.html @imgTemplate json
      if json.isVideo
        @$el.html @videoTemplate json

$ ->
  router = new PictureRouter
  Backbone.history.start()


