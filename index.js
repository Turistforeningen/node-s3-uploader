'use strict';

const fs = require('fs');
const extname = require('path').extname;
const S3 = require('aws-sdk').S3;

const auto = require('async').auto;
const each = require('async').each;
const map = require('async').map;
const uuid = require('uuid');

const resize = require('im-resize');
const metadata = require('im-metadata');

const Image = function Image(src, opts, upload) {
  this.src = src;
  this.opts = opts;
  this.upload = upload;

  return this;
};

Image.prototype.start = function start(cb) {
  auto({
    metadata: this.getMetadata.bind(this, this.src),
    dest: this.getDest.bind(this),
    versions: ['metadata', this.resizeVersions.bind(this)],
    uploads: ['versions', 'dest', this.uploadVersions.bind(this)],
    cleanup: ['uploads', this.removeVersions.bind(this)],
  }, (err, results) => {
    cb(err, results.uploads, results.metadata);
  });
};

Image.prototype.getMetadata = function getMetadata(src, cb) {
  metadata(src, {
    exif: this.upload.opts.returnExif,
    autoOrient: true,
  }, cb);
};

Image.prototype.getDest = function getDest(cb) {
  const prefix = this.opts.awsPath || this.upload.opts.aws.path;
  const path = this.opts.path || this.upload._randomPath();

  process.nextTick(() => cb(null, prefix + path));
};

Image.prototype.resizeVersions = function resizeVersions(results, cb) {
  resize(results.metadata, {
    path: this.upload.opts.resize.path,
    prefix: this.upload.opts.resize.prefix,
    quality: this.upload.opts.resize.quality,
    versions: JSON.parse(JSON.stringify(this.upload.opts.versions)),
  }, cb);
};

Image.prototype.uploadVersions = function uploadVersions(results, cb) {
  if (this.upload.opts.original) {
    const org = JSON.parse(JSON.stringify(this.upload.opts.original));

    org.original = true;
    org.width = results.metadata.width;
    org.height = results.metadata.height;
    org.path = this.src;

    results.versions.push(org);
  }

  map(results.versions, this._upload.bind(this, results.dest), cb);
};

Image.prototype.removeVersions = function removeVersions(results, cb) {
  each(results.uploads, (image, callback) => {
    if ((!this.upload.opts.cleanup.original && image.original) ||
        (!this.upload.opts.cleanup.versions && !image.original)
    ) {
      return setTimeout(callback, 0);
    }

    return fs.unlink(image.path, callback);
  }, cb);
};

Image.prototype._upload = function _upload(dest, version, cb) {
  if (version.awsImageAcl == null) {
    version.awsImageAcl = this.upload.opts.aws.acl;
  }

  const format = extname(version.path).substr(1).toLowerCase();

  const options = {
    Key: `${dest}${version.suffix || ''}.${format}`,
    ACL: version.awsImageAcl,
    Body: fs.createReadStream(version.path),
    ContentType: `image/${format === 'jpg' ? 'jpeg' : format}`,
  };

  if (version.awsImageExpires) {
    options.Expires = new Date(Date.now() + version.awsImageExpires);
  }

  if (version.awsImageMaxAge) {
    options.CacheControl = `public, max-age=${version.awsImageMaxAge}`;
  }

  this.upload.s3.putObject(options, (err, data) => {
    if (err) { return cb(err); }

    version.etag = data.ETag;
    version.key = options.Key;

    if (this.upload.opts.url) {
      version.url = this.upload.opts.url + options.Key;
    }

    return cb(null, version);
  });
};

const Upload = function Upload(bucketName, opts) {
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
    this.opts.url = `https://s3.amazonaws.com/${bucketName}/`;
  } else if (!this.opts.url && this.opts.aws.region === 'cn-north-1') {
    this.opts.url = `https://s3.${this.opts.aws.region}.amazonaws.com/${bucketName}/`;
  } else if (!this.opts.url) {
    this.opts.url = `https://s3-${this.opts.aws.region}.amazonaws.com/${bucketName}/`;
  }

  this._randomPath = this.opts.randomPath || uuid;
  this.s3 = new S3(this.opts.aws);

  return this;
};

Upload.prototype.upload = function upload(src, opts, cb) {
  const image = new Image(src, opts, this);

  image.start(cb);
};

module.exports = Upload;
module.exports.Image = Image;
