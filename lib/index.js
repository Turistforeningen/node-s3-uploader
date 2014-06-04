var S3 = require('aws-sdk').S3;
var fs = require('fs');
var gm = require('gm').subClass({ imageMagick: true });
var async = require('async');

Upload = module.exports = function(awsBucketName, options) {
  this.s3 = new S3({ params: { Bucket: awsBucketName } });

  options = options || {};

  this.awsBucketPath = options.awsBucketPath || '';
  this.awsBucketUrl = options.awsBucketUrl;
  this.awsBucketAcl = options.awsBucketAcl || 'privat';
  this.versions = options.versions || [];
  this.resizeQuality = options.resizeQuality || 70;

  return this;
};

/**
 * Generate a random path on the form of /AB/CD/EF
 *
 * @return <string> with awsBucketPath prepended
 */
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

  return this.awsBucketPath + res.join('/');
}

/**
 * Check if a path is avaiable on S3
 *
 * @param <string> path - path to check
 * @param <function> callback - (error, path, avaiable)
 */
Upload.prototype._uploadPathIsAvailable = function(path, callback) {
  this.s3.listObjects({ Prefix: path }, function(err, data) {
    if (err) { return callback(err); }
    return callback(null, path, data.Contents.length === 0);
  });
};

/**
 * Generate upload path for S3 storage
 *
 * @param <function> callback - (error, path)
 */
Upload.prototype._uploadGeneratePath = function(callback) {
  this._uploadPathIsAvailable(this._getRandomPath(), function(err, path, avaiable) {
    if (err) { return callback(err); }

    if (avaiable === true) {
      return callback(null, path);
    } else {
      return callback(new Error('Path "' + path + '" not avaiable!'));
    }
  });
};

/**
 * Resize image before uploading it
 *
 * @param <string> filePath - path to uploaded file
 * @param <object> version - file version descriptor
 * @param <function> callback - (error, buffer, version)
 */
Upload.prototype._resizeImage = function(filePath, version, callback) {
  if (version.original) {
    return process.nextTick(function() {
      return callback(null, fs.createReadStream(filePath), version);
    });
  }

  gm(filePath)
    .resize(version.maxWidth, version.maxHeight)
    .autoOrient()
    .colorspace('RGB')
    .quality(version.quality || this.resizeQuality)
    .toBuffer('jpg', function(err, buffer) {
      version.width = version.maxWidth;
      version.height = version.maxHeight;
      version.path += '.jpg';
      version.type = 'image/jpeg';

      delete version.maxHeight;
      delete version.maxWidth;

      return callback(err, buffer, version);
  });
};

/**
 * Upload image to S3
 *
 * @param <Buffer|Stream> file - file to upload
 * @param <object> version - file version descriptor
 * @param <function> callback - (error, version)
 */
Upload.prototype._uploadImage = function(file, version, callback) {
  var opts = {
    Key: version.path,
    ContentType: version.type,
    ACL: version.acl || this.awsBucketAcl,
    Body: file
  };

  delete version.type;
  if (this.awsBucketUrl) { version.url = this.awsBucketUrl + version.path; }

  this.s3.putObject(opts, function(err, res) {
    version.etag = res.ETag;
    callback(err, version);
  }.bind(this));
}

/**
 * Get image metadata
 *
 * @param <string> filePath - path to uploaded file
 * @param <object> version - file version descriptor
 * @param <function> callback - (error, value)
 */
Upload.prototype._getImageMeta = function(filePath, fn, callback) {
  gm(filePath)[fn](callback);
}

/**
 * Upload image
 *
 * @param <string> filePath - path to uploaded file
 * @param <function> callback - (error, images)
 */
Upload.prototype.upload = function(filePath, callback) {
  async.auto({
    path: async.retry(10, this._uploadGeneratePath.bind(this)),
    size: async.apply(this._getImageMeta, filePath, 'size').bind(this),
    format: async.apply(this._getImageMeta, filePath, 'format').bind(this),
    filesize: async.apply(this._getImageMeta, filePath, 'filesize').bind(this)
  },

  function(err, image) {
    if (err) { return callback(err); }

    image.format = image.format.toLowerCase();
    var versions = JSON.parse(JSON.stringify(this.versions));

    async.map(versions, function(version, mapCallback) {
      version.path = image.path + (version.suffix || version.maxWidth || '');
      delete version.suffix;

      if (version.original) {
        version.width = image.size.width;
        version.height = image.size.height;
        version.size = image.filesize;
        version.path += '.' + (image.format === 'jpeg' ? 'jpg' : image.format);
        version.type = 'image/' + image.format.toLowerCase();
      }

      async.waterfall([
        async.apply(this._resizeImage, filePath, version).bind(this),
        this._uploadImage.bind(this)
      ], mapCallback);
    }.bind(this), callback);
  }.bind(this));
};

