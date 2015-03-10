AWS S3 Image Uploader
=====================

[![Build Status](https://drone.io/github.com/Turistforeningen/node-s3-uploader/status.png)](https://drone.io/github.com/Turistforeningen/node-s3-uploader/latest)
[![npm](https://img.shields.io/npm/dm/s3-uploader.svg)]()
[![npm](https://img.shields.io/npm/v/s3-uploader.svg)]()
[![node](https://img.shields.io/node/v/s3-uploader.svg)]()
[![David](https://img.shields.io/david/turistforeningen/node-s3-uploader.svg)]()

Flexible and efficient resize, rename, and upload images to Amazon S3 disk
storage. Uses the official [AWS Node SDK](http://aws.amazon.com/sdkfornodejs/)
and [GM](https://github.com/aheckmann/gm) for image processing.

[![Join the chat at https://gitter.im/Turistforeningen/node-s3-uploader](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Turistforeningen/node-s3-uploader?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Install

```
npm install s3-uploader --save
```

## Requirements

* Node.JS >= v0.10
* imagemagic
* AWS credentials environment variables
  * `AWS_ACCESS_KEY_ID`
  * `AWS_SECRET_ACCESS_KEY`

## API

```javascript
var Upload = require('s3-uploader');
```

### new Upload(**string** `awsBucketName`, **object** `opts`)

* **string** `awsBucketName` - name of Amazon S3 bucket
* **object** `opts` - global upload options
  * **number** `resizeQuality` - thumbnail resize quallity (**default** `70`)
  * **boolean** `returnExif` - return exif data for original image (**default** `false`)
  * **string** `tmpDir` - directory to store temporary files (**default** `os.tmpdir()`)
  * **number** `workers` - number of async workers (**default** `1`)
  * **string** `url` - custom public url (**default** build from `region` and `awsBucketName`)

  * **object** `aws` - AWS SDK configuration optsion
    * **string** `region` - region for you bucket (**default** `us-east-1`)
    * **string** `path` - path within your bucket (**default** `""`)
    * **string** `acl` - default ACL for uploded images (**default** `privat`)
    * **string** `accessKeyId` - AWS access key ID override
    * **string** `secretAccessKey` - AWS secret access key override

> The `aws` object is passed directly to `aws-sdk`. You can add any of [these
> options](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor_details)
> in order to fine tune the connection – if you know what you are doing.

  * **object[]** `versions` - versions to upload to S3
    * **boolean** `original` - if this is the original image (**default** `false`)
    * **string** `suffix` - this is appended to the file name (**default** `""`)
    * **number** `quality` - resized image quality (**default** `resizeQuality`)
    * **number** `maxWidth` - max width for resized image
    * **number** `maxHeight` - max height for resized image

#### Example

```javascript
var client = new Upload('my_s3_bucket', {
  awsBucketRegion: 'us-east-1',
  awsBucketPath: 'images/',
  awsBucketAcl: 'public-read',

  versions: [{
    original: true
  },{
    suffix: '-large',
    quality: 80,
    maxHeight: 1040,
    maxWidth: 1040,
  },{
    suffix: '-medium',
    maxHeight: 780,
    maxWidth: 780
  },{
    suffix: '-small',
    maxHeight: 320,
    maxWidth: 320
  }]
});
```

### #upload(**string** `src`, **object** `opts`, **function** `cb`)

* **string** `src` - absolute path to source image to upload
* **object** `opts` - local upload config options (overwrites global config)
* **function** `cb` - callback function (**Error** `err`, **object[]** `versions`, **object** `meta`)
  * **Error** `err` - `null` if everything went fine
  * **object[]** `versions` - original and resized images with path/location
  * **object** `meta` - metadata for original image

#### Example

```javascript
client.upload('/some/file/path.jpg', {}, function(err, images, meta) {
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

## [MIT License](https://github.com/Turistforeningen/node-s3-uploader/blob/master/LICENSE)

