AWS S3 Image Uploader [![Build Status](https://drone.io/github.com/Turistforeningen/node-s3-uploader/status.png)](https://drone.io/github.com/Turistforeningen/node-s3-uploader/latest)
=====================

[![NPM](https://nodei.co/npm/s3-uploader.png?downloads=true)](https://www.npmjs.org/package/s3-uploader)

Flexible and efficient resize, rename, and upload images to Amazon S3 disk
storage. Uses the official [AWS Node SDK](http://aws.amazon.com/sdkfornodejs/)
and [GM](https://github.com/aheckmann/gm) for image processing.

## Install

```
npm install s3-uploader --save
```

## Requirements

* Node.JS >= v0.10
* imagemagic

## API

```javascript
var Upload = require('s3-uploader');
var client = new Upload('my_s3_bucket', {
  awsBucketPath: 'images/',
  awsBucketUrl: 'https://s3-eu-west-1.amazonaws.com/my_s3_bucket/',
  awsBucketAcl: 'public',
  versions: [{
    original: true
  },{
    maxHeight: 1040,
    maxWidth: 1040,
    suffix: '-large',
    quality: 80
  },{
    maxHeight: 780,
    maxWidth: 780
    suffix: '-medium',
  },{
    maxHeight: 320,
    maxWidth: 320
    suffix: '-small',
  }]
});
```

### #upload()

```javascript
client.upload('/tmp/some/file', function(err, images, exifData) {
  if (err) {
    console.error(err);
  } else {
    for (var i = 0; i < images.length; i++) {
      console.log('Thumbnail with width %i, height %i, at %s', images[i].width, images[i].height, images[i].url);
    }
  }
});
```

#### Algorithm

```
A
+-- B
    `-- C
    `-- D
    `-- E

Where A is the original image uploaded by the user. An mpc image is created, B,
which is used to crate the thumbnails C, D, and E.
```

## ToDo

* [ ] return image exif data
* [ ] return correct image size for thumbnails
* [ ] write S3 metadata defaults
* [ ] write S3 metadata per upload
* [ ] delete src image on request
* [ ] async retries options
* [ ] remove images

