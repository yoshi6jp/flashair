(function() {
  var DateCollection, DateItem, HeaderView, Params, Picture, PictureRouter, PictureView, PicturesCollection, TimelineView, View, convertFileData, ext, pad0,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  ext = {
    jpeg: ["jpeg", "jpg"],
    image: ["jpeg", "jpg", "bmp", "tiff", "tif", "png", "gif"],
    video: ["mp4", "ogg", "webm"]
  };

  pad0 = function(num, len) {
    if (len == null) {
      len = 2;
    }
    return _.last("0" + num, len).join("");
  };

  convertFileData = function(line) {
    var d, day, fattr, fdate, fext, fname, fsize, ftime, hour, isImage, isJPEG, isVideo, l, min, month, r_uri, sec, src, year;
    d = line.split(",");
    l = d.length;
    r_uri = d[0];
    fname = d.slice(1, l - 4).join(",");
    fsize = Number(d[l - 4]);
    fattr = Number(d[l - 3]);
    fdate = Number(d[l - 2]);
    ftime = Number(d[l - 1]);
    fext = _.last(fname.split(".")).toLowerCase();
    isImage = _.include(ext.image, fext);
    isVideo = _.include(ext.video, fext);
    isJPEG = _.include(ext.jpeg, fext);
    src = "" + r_uri + "/" + fname;
    year = ((fdate & 0xfc00) >> 9) + 1980;
    month = (fdate & 0x00e0) >> 5;
    day = fdate & 0x001f;
    hour = (ftime & 0xf800) >> 11;
    min = (ftime & 0x07e0) >> 5;
    sec = ftime & 0x001f;
    return {
      id: src,
      r_uri: r_uri,
      fname: fname,
      fsize: fsize,
      fattr: fattr,
      fdate: fdate,
      ftime: ftime,
      fext: fext,
      isHidden: !!(fattr & 0x02),
      year: year,
      month: month,
      day: day,
      hour: hour,
      min: min,
      sec: sec,
      src: src,
      isDir: !!(fattr & 0x10),
      isImage: isImage,
      isVideo: isVideo,
      isJPEG: isJPEG,
      isPicture: isImage || isVideo,
      href: "#picture/" + src,
      thumbnail: isJPEG ? "/thumbnail.cgi?" + src : src,
      date: "" + year + "/" + month + "/" + day,
      time: "" + (pad0(hour)) + ":" + (pad0(min)) + ":" + (pad0(sec)),
      title: fname
    };
  };

  Params = (function(_super) {
    __extends(Params, _super);

    function Params() {
      return Params.__super__.constructor.apply(this, arguments);
    }

    Params.prototype.defaults = {
      year: null,
      month: null,
      day: null,
      time: null
    };

    Params.prototype.type = function() {
      var json;
      json = this.toJSON();
      if (json.year && json.month && json.day) {
        return "pictures";
      } else if (json.year && json.month) {
        return "days";
      } else if (json.year) {
        return "months";
      } else {
        return "years";
      }
    };

    return Params;

  })(Backbone.Model);

  DateItem = (function(_super) {
    __extends(DateItem, _super);

    function DateItem() {
      return DateItem.__super__.constructor.apply(this, arguments);
    }


    /*
    id: "2014" or "2014/10" or "2014/10/10"
    picture:
    type: "Year" "Month" "Day"
     */

    DateItem.prototype.resetCount = function() {
      return this.set("count", 0);
    };

    DateItem.prototype.addCount = function() {
      return this.set("count", (this.get("count") || 0) + 1);
    };

    DateItem.prototype.getPicture = function(type) {
      var picture;
      picture = this.get("picture").toJSON();
      switch (type) {
        case "year":
          picture.href = "#timeline/" + picture.year;
          picture.title = picture.year;
          picture.count = this.get("count");
          break;
        case "month":
          picture.href = "#timeline/" + picture.year + "/" + picture.month;
          picture.title = picture.month;
          picture.title = "" + picture.year + "/" + picture.month;
          picture.count = this.get("count");
          break;
        case "day":
          picture.href = "#timeline/" + picture.year + "/" + picture.month + "/" + picture.day;
          picture.title = picture.day;
          picture.title = "" + picture.year + "/" + picture.month + "/" + picture.day;
          picture.count = this.get("count");
      }
      return picture;
    };

    return DateItem;

  })(Backbone.Model);

  DateCollection = (function(_super) {
    __extends(DateCollection, _super);

    function DateCollection() {
      return DateCollection.__super__.constructor.apply(this, arguments);
    }

    DateCollection.prototype.model = DateItem;

    DateCollection.prototype.isCompleted = false;

    DateCollection.prototype.addPicture = function(picture) {
      var day, dayId, month, monthId, year, yearId;
      if (!(picture.get("isVideo") || picture.get("isImage"))) {
        return;
      }
      year = picture.get("year");
      month = picture.get("month");
      day = picture.get("day");
      yearId = year;
      monthId = [year, month].join("/");
      dayId = [year, month, day].join("/");
      this.upsertItem({
        id: year,
        type: "year",
        year: year,
        picture: picture
      });
      this.upsertItem({
        id: month,
        type: "month",
        year: year,
        month: month,
        picture: picture
      });
      return this.upsertItem({
        id: day,
        type: "day",
        year: year,
        month: month,
        day: day,
        picture: picture
      });
    };

    DateCollection.prototype.upsertItem = function(attr) {
      this.set([attr], {
        remove: false
      });
      return this.get(attr.id).addCount();
    };

    DateCollection.prototype.getPictures2 = function(attr) {
      return _.invoke(this.where(attr), "getPicture", attr.type);
    };

    DateCollection.prototype.getPictures = function(attr) {
      return _(this.where(attr)).invoke("getPicture", attr.type).sortBy(function(item) {
        return item[attr.type];
      }).valueOf();
    };

    DateCollection.prototype.syncPictures = function(pictures) {
      this.invoke("resetCount");
      pictures.each((function(_this) {
        return function(picture) {
          return _this.addPicture(picture);
        };
      })(this));
      return this.trigger("update:pictures");
    };

    return DateCollection;

  })(Backbone.Collection);

  Picture = (function(_super) {
    __extends(Picture, _super);

    function Picture() {
      return Picture.__super__.constructor.apply(this, arguments);
    }

    Picture.prototype.defaults = {
      title: "",
      count: ""
    };

    return Picture;

  })(Backbone.Model);

  PicturesCollection = (function(_super) {
    __extends(PicturesCollection, _super);

    function PicturesCollection() {
      return PicturesCollection.__super__.constructor.apply(this, arguments);
    }

    PicturesCollection.prototype.model = Picture;

    PicturesCollection.prototype.url = "/command.cgi";

    PicturesCollection.prototype.parse = function(resp) {
      var lines;
      lines = _(resp.split(/\r\n|\r|\n/)).rest().initial().valueOf();
      return resp.results = _(lines).map(convertFileData).reject(function(file) {
        return file.isHidden || file.isHiddenRoot;
      }).valueOf();
    };

    PicturesCollection.prototype.getSubDir = function() {
      var defer, dirs;
      defer = $.Deferred();
      dirs = this.where({
        isDir: true
      });
      if (_.isEmpty(dirs)) {
        defer.resolve();
      } else {
        this.remove(dirs, {
          silent: true
        });
        $.when.apply(null, _.map(dirs, (function(_this) {
          return function(dir) {
            return _this.getFiles(dir.get("src")).then(function() {
              return _this.getSubDir();
            }).then(function() {
              return defer.resolve();
            });
          };
        })(this)));
      }
      return defer;
    };

    PicturesCollection.prototype.getFiles = function(path) {
      if (path == null) {
        path = "/";
      }
      return this.fetch({
        remove: false,
        dataType: "text",
        data: {
          op: 100,
          DIR: path
        }
      });
    };

    PicturesCollection.prototype.startMonitoring = function(immediate) {
      var defer;
      if (immediate == null) {
        immediate = false;
      }
      defer = $.Deferred();
      if (immediate) {
        defer.resolve();
      } else {
        _.delay(defer.resolve, 10 * 1000);
      }
      return defer.then((function(_this) {
        return function() {
          return _this.remoteIsUpdated();
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.update();
        };
      })(this)).always((function(_this) {
        return function() {
          return _this.startMonitoring();
        };
      })(this));
    };

    PicturesCollection.prototype.remoteIsUpdated = function() {
      var defer;
      defer = $.Deferred();
      $.ajax({
        url: "/command.cgi",
        data: {
          op: 102
        }
      }).then(function(res) {
        if ($.trim(res) === "1") {
          return defer.resolve();
        } else {
          return defer.reject();
        }
      }, defer.reject);
      return defer;
    };

    PicturesCollection.prototype.update = function() {
      var defer;
      defer = $.Deferred();
      this.getFiles().then((function(_this) {
        return function() {
          return _this.getSubDir();
        };
      })(this)).then((function(_this) {
        return function() {
          defer.resolve();
          return _this.trigger("update:completed");
        };
      })(this));
      return defer;
    };

    return PicturesCollection;

  })(Backbone.Collection);

  PictureRouter = (function(_super) {
    __extends(PictureRouter, _super);

    function PictureRouter() {
      return PictureRouter.__super__.constructor.apply(this, arguments);
    }

    PictureRouter.prototype.initialize = function() {
      this.params = new Params;
      this.pictures = new PicturesCollection;
      this.dateItems = new DateCollection;
      window.pict = this.pictures;
      window.di = this.dateItems;
      this.listenTo(this.pictures, "sync", this.syncPictures);
      this.listenToOnce(this.pictures, "update:completed", (function(_this) {
        return function() {
          _this.stopListening(_this.pictures, "sync", _this.syncPictures);
          return _this.listenTo(_this.pictures, "update:completed", _this.syncPictures);
        };
      })(this));
      this.pictures.update().then((function(_this) {
        return function() {
          return _this.pictures.startMonitoring();
        };
      })(this));
      this.headerView = new HeaderView({
        el: "#header",
        params: this.params
      });
      this.headerView.render();
      this.timelineView = new TimelineView({
        el: "#timeline",
        collection: this.pictures,
        params: this.params,
        dateItems: this.dateItems
      });
      this.timelineView.render();
      this.pictureView = new PictureView({
        el: "#picture",
        collection: this.pictures,
        params: this.params
      });
      this.pictureView.render();
      return PictureRouter.__super__.initialize.apply(this, arguments);
    };

    PictureRouter.prototype.syncPictures = function() {
      return _.delay((function(_this) {
        return function() {
          return _this.dateItems.syncPictures(_this.pictures);
        };
      })(this), 100);
    };

    PictureRouter.prototype.routes = {
      "timeline": "timeline",
      "timeline/:year": "timeline",
      "timeline/:year/:month": "timeline",
      "timeline/:year/:month/:day": "timeline",
      "picture/*path": "picture",
      ".*": "defaultRoute"
    };

    PictureRouter.prototype.timeline = function(year, month, day) {
      this.headerView.show();
      this.timelineView.show();
      this.pictureView.hide();
      return this.params.set({
        year: Number(year),
        month: Number(month),
        day: Number(day),
        time: null
      });
    };

    PictureRouter.prototype.picture = function(path) {
      this.headerView.show();
      this.timelineView.hide();
      this.pictureView.setPath(path);
      return this.pictureView.show();
    };

    PictureRouter.prototype.defaultRoute = function() {
      return this.navigate("timeline", {
        trigger: true,
        replace: true
      });
    };

    return PictureRouter;

  })(Backbone.Router);

  View = (function(_super) {
    __extends(View, _super);

    function View() {
      return View.__super__.constructor.apply(this, arguments);
    }

    View.prototype.render = function() {
      return this.$el.html(this.template());
    };

    View.prototype.show = function() {
      return this.$el.removeClass("hidden");
    };

    View.prototype.hide = function() {
      return this.$el.addClass("hidden");
    };

    return View;

  })(Backbone.View);

  HeaderView = (function(_super) {
    __extends(HeaderView, _super);

    function HeaderView() {
      return HeaderView.__super__.constructor.apply(this, arguments);
    }

    HeaderView.prototype.template = _.template("<div class=\"container-fluid\">\n  <div class=\"navbar-header\">\n    <ul class=\"nav nav-pills\">\n  <% if(year){ %>\n    <% if(time){ %>\n      <li>\n        <a href=\"#timeline/<%- year %>/<%- month %>/<%- day %>\">\n          <span class=\"glyphicon glyphicon-calendar\"></span> <%- year %>/<%- month %>/<%- day %>\n        </a>\n      </li>\n      <li class=\"disabled\"><a>/</a></li>\n      <li class=\"active\"><a><span class=\"glyphicon glyphicon-time\"></span> <%- time %></a></li>\n    <% }else if(day){ %>\n      <li><a href=\"#timeline\">Top</a></li>\n      <li><a href=\"#timeline/<%- year %>\"><%- year %></a></li>\n      <li class=\"disabled\"><a>/</a></li>\n      <li><a href=\"#timeline/<%- year %>/<%- month %>\"><%- month %></a></li>\n      <li class=\"disabled\"><a>/</a></li>\n      <li class=\"active\"><a href=\"#timeline/<%- year %>/<%- month %>/<%- day %>\"><%- day %></a></li>\n    <% }else if(month){ %>\n      <li><a href=\"#timeline\">Top</a></li>\n      <li><a href=\"#timeline/<%- year %>\"><%- year %></a></li>\n      <li class=\"disabled\"><a>/</a></li>\n      <li class=\"active\"><a href=\"#timeline/<%- year %>/<%- month %>\"><%- month %></a></li>\n    <% }else{ %>\n      <li><a href=\"#timeline\">Top</a></li>\n      <li class=\"active\"><a href=\"#timeline/<%- year %>\"><%- year %></a></li>\n    <%}%>\n  <% }else{ %>\n      <li class=\"active\"><a href=\"#timeline\">Top</a></li>\n  <%}%>\n    </ul>\n  </div>\n</div>");

    HeaderView.prototype.initialize = function(options) {
      this.params = options != null ? options.params : void 0;
      this.listenTo(this.params, "change", this.render);
      return HeaderView.__super__.initialize.apply(this, arguments);
    };

    HeaderView.prototype.render = function() {
      return this.$el.html(this.template(this.params.toJSON()));
    };

    return HeaderView;

  })(View);


  /*
   */

  TimelineView = (function(_super) {
    __extends(TimelineView, _super);

    function TimelineView() {
      return TimelineView.__super__.constructor.apply(this, arguments);
    }

    TimelineView.prototype.template_x = _.template("<div class=\"row board\"></div>");

    TimelineView.prototype.template = _.template("<ul class=\"board\"></ul>");

    TimelineView.prototype.itemsTemplate = _.template("<% _.each(items, function(item){%>\n  <li class=\"picture\">\n    <a href=\"<%- item.href %>\" class=\"thumbnail\">\n    <% if(item.isImage) { %>\n      <img class=\"lazy\" data-original=\"<%- item.thumbnail %>\" alt=\"\" />\n    <%}else if(item.isVideo){ %>\n      <video src=\"<%- item.src %>\" ></video>\n    <%}else { %>\n      <span class=\"label label-info\"><%- item.fext %></span>\n    <%} %>\n    <% if(item.count){ %>\n      <div class=\"caption\"><span class=\"memo\"><%- item.title %></span> <span class=\"badge pull-right\"><%- item.count %></span> </div>\n    <%}else{%>\n      <div class=\"caption filename\"><span class=\"memo\"><%- item.title %></span></div>\n    <%}%>\n    </a>\n  </li>\n<%});%>");

    TimelineView.prototype.itemsTemplate_x = _.template("\n<% _.each(items, function(item){%>\n  <div class=\"col-xs-6 col-sm-3\">\n  <% if(item.title){%>\n    <div>\n      <span class=\"label label-info\"><%- item.title %></span>\n    </div>\n  <%}%>\n    <a href=\"<%- item.href %>\" class=\"thumbnail\">\n    <% if(item.isImage) { %>\n      <img class=\"lazy\" data-original=\"<%- item.thumbnail %>\" alt=\"\">\n    <%}else if(item.isVideo){ %>\n      <video src=\"<%- item.src %>\" >\n    <%}else { %>\n      <span class=\"label label-info\"><%- item.fext %></span>\n    <%} %>\n    </a>\n  </div>\n<%});%>");

    TimelineView.prototype.initialize = function(options) {
      TimelineView.__super__.initialize.apply(this, arguments);
      this.pictures = options != null ? options.pictures : void 0;
      this.params = options != null ? options.params : void 0;
      this.dateItems = options != null ? options.dateItems : void 0;
      this.listenTo(this.dateItems, "update:pictures", this.itemsRender);
      return this.listenTo(this.params, "change", this.itemsRender);
    };

    TimelineView.prototype.itemsRender = function() {
      var items;
      switch (this.params.type()) {
        case "years":
          items = this.dateItems.getPictures({
            type: "year"
          });
          break;
        case "months":
          items = this.dateItems.getPictures({
            type: "month",
            year: this.params.get("year")
          });
          break;
        case "days":
          items = this.dateItems.getPictures({
            type: "day",
            year: this.params.get("year"),
            month: this.params.get("month")
          });
          break;
        default:
          items = this.collection.where({
            year: this.params.get("year"),
            month: this.params.get("month"),
            day: this.params.get("day")
          });
          items = _.invoke(items, "toJSON");
      }
      this.$(".board").html(this.itemsTemplate({
        items: items
      }));
      this.$(".thumbnail video").each(function() {
        var $video;
        $video = $(this);
        if ($video.height() === 150) {
          return $video.height($video.width() * 0.75);
        }
      });
      return this.$("img.lazy").lazyload({
        effect: "fadeIn"
      });
    };

    return TimelineView;

  })(View);

  PictureView = (function(_super) {
    __extends(PictureView, _super);

    function PictureView() {
      return PictureView.__super__.constructor.apply(this, arguments);
    }

    PictureView.prototype.template = _.template("<div class=\"well picture-loading\">\n  <h1>Loading ...</h1>\n</div>");

    PictureView.prototype.imgTemplate = _.template("<img class=\"img-thumbnail\" src=\"<%- src %>\"/>\n<div class=\"exif-info fade\">\n  <div class=\"row\">\n    <div class=\"col-xs-12 col-md-8 col-md-offset-2\">\n      <div class=\"row exif-list\">\n      </div>\n    </div>\n  </div>\n</div>");

    PictureView.prototype.exifTemplate = _.template("<div class=\"col-xs-4 text-right\"><span class=\"glyphicon glyphicon-picture\"></span> :</div>\n<div class=\"col-xs-8 text-left\"><%- picture.fname %></div>\n<% _.each(exif, function(value, key){%>\n<div class=\"col-xs-4 text-right\"><strong><%- key %></strong> :</div>\n<div class=\"col-xs-8 text-left\"><%- value %> </div>\n<%}) %>");

    PictureView.prototype.videoTemplate = _.template("<video class=\"img-thumbnail\" src=\"<%- src %>\" controls ></video>");

    PictureView.prototype.initialize = function(options) {
      this.params = options != null ? options.params : void 0;
      return PictureView.__super__.initialize.apply(this, arguments);
    };

    PictureView.prototype.show = function() {
      $("body").addClass("full-screen");
      return PictureView.__super__.show.apply(this, arguments);
    };

    PictureView.prototype.hide = function() {
      PictureView.__super__.hide.apply(this, arguments);
      return $("body").removeClass("full-screen");
    };

    PictureView.prototype.getPicture = function(path) {
      var defer, picture;
      defer = $.Deferred();
      picture = this.collection.get(path);
      if (picture) {
        defer.resolve(picture);
      } else {
        this.collection.once("sync", (function(_this) {
          return function() {
            return _this.getPicture(path).then(defer.resolve);
          };
        })(this));
      }
      return defer;
    };

    PictureView.prototype.events = {
      "click img": "toggleEXIF"
    };

    PictureView.prototype.toggleEXIF = function() {
      var img;
      if (this.$(".exif-info").hasClass("in")) {
        return this.$(".exif-info").removeClass("in");
      } else {
        img = this.$("img").get(0);
        return EXIF.getData(img, (function(_this) {
          return function() {
            var exif;
            exif = _.pick(EXIF.getAllTags(img), ["ImageDescription", "Make", "Model", "FNumber", "ISOSpeedRatings", "Flash", "PixelXDimension", "PixelYDimension", "WhiteBalance"]);
            exif.Maker = exif.ImageDescription || exif.Make;
            exif.ISO = exif.ISOSpeedRatings;
            exif.Size = "" + exif.PixelXDimension + " x " + exif.PixelYDimension;
            exif["F"] = exif.FNumber;
            exif["W/B"] = exif.WhiteBalance;
            delete exif.ImageDescription;
            delete exif.Make;
            delete exif.ISOSpeedRatings;
            delete exif.PixelXDimension;
            delete exif.PixelYDimension;
            delete exif.FNumber;
            delete exif.WhiteBalance;
            _this.$(".exif-list").html(_this.exifTemplate({
              exif: exif,
              picture: _this.picture.toJSON()
            }));
            return _this.$(".exif-info").addClass("in");
          };
        })(this));
      }
    };

    PictureView.prototype.setPath = function(path) {
      return this.getPicture(path).then((function(_this) {
        return function(picture) {
          var json;
          json = picture.toJSON();
          _this.picture = picture;
          _this.params.set({
            year: Number(json.year),
            month: Number(json.month),
            day: Number(json.day),
            time: json.time
          });
          if (json.isImage) {
            _this.$el.html(_this.imgTemplate(json));
          }
          if (json.isVideo) {
            return _this.$el.html(_this.videoTemplate(json));
          }
        };
      })(this));
    };

    return PictureView;

  })(View);

  $(function() {
    var router;
    router = new PictureRouter;
    return Backbone.history.start();
  });

}).call(this);
