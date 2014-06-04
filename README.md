node-s3-uploader
================

Resize, rename, and upload images to AWS S3

## Install

```
npm install s3-uploader --save
```

## API

```javascript
var Upload = require('s3-uploader');
var client = new Upload('my_s3_bucket', {
  awsBucketPath: '/images',
  awsBucketUrl: 'https://some.domain.com/images',
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

#### Usage

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

## ToDo

* [ ] return image exif data
* [ ] return correct image size for thumbnails
* [ ] write S3 metadata defaults
* [ ] write S3 metadata per upload
* [ ] delete src image on request
* [ ] async retries options
* [ ] remove images

