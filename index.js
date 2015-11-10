'use strict';

var fs = require('fs');
var extname = require('path').extname;
var S3 = require('aws-sdk').S3;

var auto = require('async').auto;
var each = require('async').each;
var map = require('async').map;
var retry = require('async').retry;

var resize = require('im-resize');
var metadata = require('im-metadata');

var Upload, Image;

Upload = module.exports = function(bucketName, opts) {
  this.opts = opts || {};

  if (!bucketName) {
    throw new TypeError('Bucket name can not be undefined');
  }

  if (!this.opts.aws) { this.opts.aws = {}; }
  if (!this.opts.aws.acl) { this.opts.aws.acl = 'private'; }

  if (!this.opts.aws.httpOptions) { this.opts.aws.httpOptions = {}; }
  if (!this.opts.aws.httpOptions.timeout) {
    this.opts.aws.httpOptions.timeout = 10000;
  }

  if (!this.opts.aws.maxRetries) { this.opts.aws.maxRetries = 3; }
  if (!this.opts.aws.params) { this.opts.aws.params = {}; }
  this.opts.aws.params.Bucket = bucketName;
  if (!this.opts.aws.path) { this.opts.aws.path = ''; }
  if (!this.opts.aws.region) { this.opts.aws.region = 'us-east-1'; }
  if (!this.opts.aws.sslEnabled) { this.opts.aws.sslEnabled = true; }

  if (!this.opts.cleanup) { this.opts.cleanup = {}; }
  if (!this.opts.returnExif) { this.opts.returnExif = false; }

  if (!this.opts.resize) { this.opts.resize = {}; }
  if (!this.opts.resize.quality) { this.opts.resize.quality = 70; }

  if (!this.opts.versions) { this.opts.versions = []; }

  if (!this.opts.url && this.opts.aws.region === 'us-east-1') {
    this.opts.url = 'https://s3.amazonaws.com/' + bucketName + '/';
  } else if (!this.opts.url) {
    this.opts.url = [
      'https://s3-', this.opts.aws.region, '.amazonaws.com/', bucketName, '/'
    ].join('');
  }

  this._randomPath = this.opts.randomPath || require('@starefossen/rand-path');
  this.s3 = new S3(this.opts.aws);

  return this;
};

Upload.prototype._getDestPath = function(prefix, callback) {
  var $this = this;

  retry(5, function(cb) {
    var path = prefix + $this._randomPath();

    $this.s3.listObjects({
      Prefix: path
    }, function(err, data) {
      if (err) {
        return cb(err);
      }
      if (data.Contents.length === 0) {
        return cb(null, path);
      }
      return cb(new Error('Path ' + path + ' not avaiable'));
    });
  }, callback);
};

Upload.prototype.upload = function(src, opts, cb) {
  var image = new Image(src, opts, this);

  image.start(cb);
};

Image = module.exports.Image = function(src, opts, upload) {
  this.src = src;
  this.opts = opts;
  this.upload = upload;

  return this;
};

Image.prototype.start = function(cb) {
  auto({
    metadata: this.getMetadata.bind(this, this.src),
    dest: this.getDest.bind(this),
    versions: ['metadata', this.resizeVersions.bind(this)],
    uploads: ['versions', 'dest', this.uploadVersions.bind(this)],
    cleanup: ['uploads', this.removeVersions.bind(this)]
  }, function(err, results) {
    cb(err, results.uploads, results.metadata);
  });
};

Image.prototype.getMetadata = function(src, cb) {
  metadata(src, {
    exif: this.upload.opts.returnExif,
    autoOrient: true
  }, cb);
};

Image.prototype.getDest = function(cb) {
  var prefix = this.opts.awsPath || this.upload.opts.aws.path;
  var $this = this;

  if (this.opts.path) {
    return process.nextTick(function() {
      cb(null, prefix + $this.opts.path);
    });
  }

  return this.upload._getDestPath(prefix, cb);
};

Image.prototype.resizeVersions = function(cb, results) {
  resize(results.metadata, {
    path: this.upload.opts.resize.path,
    prefix: this.upload.opts.resize.prefix,
    quality: this.upload.opts.resize.quality,
    versions: JSON.parse(JSON.stringify(this.upload.opts.versions))
  }, cb);
};

Image.prototype.uploadVersions = function(cb, results) {
  if (this.upload.opts.original) {
    var org = JSON.parse(JSON.stringify(this.upload.opts.original));

    org.original = true;
    org.width = results.metadata.width;
    org.height = results.metadata.height;
    org.path = this.src;

    results.versions.push(org);
  }

  map(results.versions, this._upload.bind(this, results.dest), cb);
};

Image.prototype.removeVersions = function(cb, results) {
  var $this = this;

  each(results.uploads, function(image, callback) {
    if (!$this.upload.opts.cleanup.original && image.original ||
        !$this.upload.opts.cleanup.versions && !image.original)
    {
      return setTimeout(callback, 0);
    }

    return fs.unlink(image.path, callback);
  }, function() {
    cb();
  });
};

Image.prototype._upload = function(dest, version, cb) {
  var $this = this;

  if (version.awsImageAcl == null) {
    version.awsImageAcl = this.upload.opts.aws.acl;
  }

  var format = extname(version.path).substr(1).toLowerCase();

  var options = {
    Key: '' + dest + (version.suffix || '') + '.' + format,
    ACL: version.awsImageAcl,
    Body: fs.createReadStream(version.path),
    ContentType: 'image/' + (format === 'jpg' ? 'jpeg' : format)
  };

  if (version.awsImageExpires) {
    options.Expires = new Date(Date.now() + version.awsImageExpires);
  }

  if (version.awsImageMaxAge) {
    options.CacheControl = 'public, max-age=' + version.awsImageMaxAge;
  }

  this.upload.s3.putObject(options, function(err, data) {
    if (err) { return cb(err); }

    version.etag = data.ETag;
    version.key = options.Key;

    if ($this.upload.opts.url) {
      version.url = $this.upload.opts.url + options.Key;
    }

    cb(null, version);
  });
};
