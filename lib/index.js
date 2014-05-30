S3 = require('AWS').S3;

Upload = (awsBucketName, options) {
  this.s3 = new S3({ params: { Bucket: awsBucketName } });

  // Set options
  this.path = options.path || '/';
  this.url = options.url || null;
  this.sizes = options.sizes || [780, 320];
  this.keepOriginal = options.keepOriginal || true; // @TODO this won't work
  
  return this;
}

Upload.prototype._resize = () {
  // resize image
  throw new Error('Not implemeted');
}

Upload.prototype._upload = () {
  // upload to aws
  throw new Error('Not implemeted');
}

Upload.prototype.upload = (tmpFile, callback) {
  // this is the publicly accessible method
}
