S3 = require('aws-sdk').S3;

Upload = function(awsBucketName, options) {
  this.s3 = new S3({ params: { Bucket: awsBucketName } });

  // Set options
  this.path = options.path || '';
  this.url = options.url || null;
  this.sizes = options.sizes || [780, 320];
  this.keepOriginal = options.keepOriginal || true; // @TODO this won't work

  return this;
}

Upload.prototype._resize = function() {
  throw new Error('Not implemeted');
}

Upload.prototype._upload = function(files, callback) {
  this._uploadGeneratePath(function(err, path) {
    // @TODO error checking

    // @TODO use async for this
    for (var i = 0; i < files.length; i++) {
      var key = path + files[i].width + '.' + files[i].ext;
      fs.readFile(files[i].tmpName, function(err, data) {
        if (err) return callback(err);
        s3.putObject({Key: key, data: data}, function(err, data) {
          if (err) return err
          // image is uploaded
        });
      });
    }
  });
}

Upload.prototype._uploadGeneratePath = function(callback) {
  this._uploadPathIsAvailable('ab/cd/ef', function(err, avaiable) {
    if (err) { return callback(err); }
    if (avaiable) { return callback(null, path); }
    // @TODO find another path
  });
}

Upload.prototype._uploadPathIsAvailable = function(path, callback) {
  this.s3.listObjects({ Prefix: path }, function(err, data) {
    if (err) return callback(err);
    return callback(null, data.Contents.length === 0);
  })
}

Upload.prototype.upload = function(tmpFile, callback) {
  // this is the publicly accessible method
}
