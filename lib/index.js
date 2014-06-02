var S3 = require('aws-sdk').S3;
var fs = require('fs');
var gm = require('gm').subClass({ imageMagick: true });
var path = require('path');
var os = require('os');
var async = require('async');

Upload = module.exports = function(awsBucketName, options) {
  this.s3 = new S3({ params: { Bucket: awsBucketName } });

  // Set options
  options = options || {};
  this.s3Defaults = options.s3Defaults || {};
  this.path = options.path || '';
  this.url = options.url;
  this.sizes = options.sizes || [780, 320];
  this.keepOriginal = options.keepOriginal || true; // @TODO this won't work,
  this.owner = options.owner || '';
  this.license = options.license || '';

  return this;
};

Upload.prototype._resize = function(tmpFile, maxSize, afterResize) {
  var owner = this.owner;
  var license = this.license;

  if (!maxSize) {
    // NOTE: This does not work.
    gm(tmpFile).colorspace('RGB').autoOrient().comment(owner + license).toBuffer(err, buff);
  } else {

    this._getNewSize(tmpFile, maxSize, function (size) {
      gm(tmpFile).resize(size.width, size.height).noProfile().toBuffer(function (err, buff) {
        afterResize(err, buff);
      });
    });
  }
};

Upload.prototype._getNewSize = function (path, size, callback) {

  this._getOrientation(path, function (err, orientation) {
    var width = null,
        height = null;

    if (orientation == 'portrait') {
      height = size;
    } else if (orientation == 'landscape' || orientation == 'square') {
      width = size;
    }

    callback({width: width, height: height});

  });


};


Upload.prototype._getOrientation = function (path, callback) {
  this._getSize(path, function(err, size) {
    var orientation,
        height = size.height,
        width = size.width;

    if (height > width) {
      orientation = 'portrait';
    } else if (height < width) {
      orientation = 'landscape';
    } else if (heigth === width) {
      orientation = 'square';
    }

    callback(err, orientation);
  });
};

Upload.prototype._getSize = function (path, callback) {
  gm(path).size(function (err, value) {
    callback(err, value);
  });
};

Upload.prototype._localGeneratePath = function () {
  var filepath = this._getRandomPath();
  if (this._localPathIsAvailable()) {
    return filepath;
  } else {
    this._localGeneratePath();
  }
};

Upload.prototype._localPathIsAvailable = function(path) {
  return !fs.existsSync(os.tmpdir() + path);
};


Upload.prototype._uploadBuffer = function(buffer, path, type, opts, callback) {
  var keys = Object.keys(this.s3Defaults)
    , key
    , i;

  opts.ContentType = type;
  opts.Body = buffer;
  opts.Key = path;

  // Set default options
  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    opts[key] = opts[key] || this.s3Defaults[key];
  }

  this.s3.putObject(opts, callback);
}



Upload.prototype._upload = function(files, callback) {
  var $this = this;

  this._uploadGeneratePath(function(err, path) {
    if (err) return callback(err);

    // For file in files
    async.map(files, function(file, cb) {
      file.key = path + (!file.org ? '-' + file.width : '') + '.' + file.ext;

      if ($this.url) { file.url = $this.url + file.key; }

      // Read file from disk
      fs.readFile(file.tmpName, function(err, fileData) {
        if (err) return cb(err);

        var opts = {
          Key: file.key,
          ContentType: file.contentType,
          ACL: 'public-read',
          Body: fileData
        };

        // Store file in S3 bucket
        $this.s3.putObject(opts, function(err, data) {
          if (err) return cb(err);

          file.etag = data.ETag;
          return cb(null, file);
        });
      });
    }, callback);
  });
};

Upload.prototype._getRandomPath = function() {
  var input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      , res = []
      , i
      , x
      , y

  for (i = 0; i < 3; i++) {
    x = input[Math.floor((Math.random() * input.length))]
    y = input[Math.floor((Math.random() * input.length))]

    res.push(x + y);
  }

  return this.path + res.join('/');
}

Upload.prototype._uploadPathIsAvailable = function(path, callback) {
  this.s3.listObjects({ Prefix: path }, function(err, data) {
    if (err) return callback(err);
    return callback(null, data.Contents.length === 0);
  });
};

Upload.prototype._uploadGeneratePath = function(callback) {
  var path = this._getRandomPath()
   , $this = this;

  this._uploadPathIsAvailable(path, function(err, isAvaiable) {
    if (err) { return callback(err); }
    if (isAvaiable) { return callback(null, path); }

    // Find another avaiable path
    $this._uploadGeneratePath(callback);
  });
};

Upload.prototype.upload = function(tmpFile, callback) {
  // this is the publicly accessible method
};
