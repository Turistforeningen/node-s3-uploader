AWS S3 Image Uploader
=====================

**Documentation for `s3-uploader@0.9` can be found [here](https://github.com/Turistforeningen/node-s3-uploader/blob/stable/0.x/README.md).**

[![Build status](https://img.shields.io/wercker/ci/54f18246d9b14636634ff908.svg "Build status")](https://app.wercker.com/project/bykey/50fbdf51cf64b01a738379a028b8a885)
[![NPM downloads](https://img.shields.io/npm/dm/s3-uploader.svg "NPM downloads")](https://www.npmjs.com/package/s3-uploader)
[![NPM version](https://img.shields.io/npm/v/s3-uploader.svg "NPM version")](https://www.npmjs.com/package/s3-uploader)
[![Node version](https://img.shields.io/node/v/s3-uploader.svg "Node version")](https://www.npmjs.com/package/s3-uploader)
[![Dependency status](https://img.shields.io/david/turistforeningen/node-s3-uploader.svg "Dependency status")](https://david-dm.org/turistforeningen/node-s3-uploader)

Flexible and efficient image resize, rename, and upload to Amazon S3 disk
storage. Uses the official [AWS Node SDK](http://aws.amazon.com/sdkfornodejs/),
and [im-resize](https://github.com/Turistforeningen/node-im-resize) and
[im-metadata](https://github.com/Turistforeningen/node-im-metadata) for image
processing.

![Overview of image upload to AWS S3](https://docs.google.com/drawings/d/1EZaE8LaQ6FRSg4R-2QQiT1af-y2AgDknBGrx6SPIKy0/pub?w=766&h=216)

[![Join the chat at https://gitter.im/Turistforeningen/node-s3-uploader](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Turistforeningen/node-s3-uploader)

## Changelog

All changes are documentated on the [releases page](https://github.com/Turistforeningen/node-s3-uploader/releases).
Changes for latest release can be [found here](https://github.com/Turistforeningen/node-s3-uploader/releases/latest).

## Install

```
npm install s3-uploader --save
```

## Requirements

* Node.JS >= v0.10
* ImageMagic >= v6.8
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
  * **object** `cleanup`
    * **boolean** `original` - remove original image after successful upload (**default**: `false`)
    * **boolean** `versions` - remove thumbnail versions after sucessful upload (**default**: `false`)

  * **boolean** `returnExif` - return exif data for original image (**default** `false`)

  * **string** `url` - custom public url (**default** build from `region` and `awsBucketName`)

  * **object** `aws` - see [note](#aws-note)
    * **string** `region` - region for you bucket (**default** `us-east-1`)
    * **string** `path` - path within your bucket (**default** `""`)
    * **string** `acl` - default ACL for uploaded images (**default** `private`)
    * **string** `accessKeyId` - AWS access key ID override
    * **string** `secretAccessKey` - AWS secret access key override

  * **object** `resize`
    * **string** `path` - local directory for resized images (**default**: same as original image)
    * **string** `prefix` - local file name prefix for resized images (**default**: `""`)
    * **integer** `quality` - default quality for resized images (**default**: `70`)

  * **object[]** `versions`
    * **string** `suffix` - image file name suffix (**default** `""`)
    * **number** `quality` - image resize quality
    * **string** `format` - force output image file format (**default** `format of original image`)
    * **number** `maxWidth` - max width for resized image
    * **number** `maxHeight` - max height for resized image
    * **string** `aspect` - force aspect ratio for resized image (**example:** `4:3`
    * **string** `background` - set background for transparent images (**example:** `red`)
    * **boolean** `flatten` - flatten backgrund for transparent images
    * **string** `awsImageAcl` - access control for AWS S3 upload (**example:** `private`)
    * **number** `awsImageExpires` - add `Expires` header to image version
    * **number** `awsImageMaxAge` - add `Cache-Control: max-age` header to image version

  * **object** `original`
    * **string** `awsImageAcl` - access control for AWS S3 upload (**example:** `private`)
    * **number** `awsImageExpires` - add `Expires` header to image version
    * **number** `awsImageMaxAge` - add `Cache-Control: max-age` header to image version

  * **function** `randomPath` - custom random path function

#### AWS note
> The `aws` object is passed directly to `aws-sdk`. You can add any of [these
> options](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor_details)
> in order to fine tune the connection – if you know what you are doing.

#### Example

```javascript
var client = new Upload('my_s3_bucket', {
  aws: {
    path: 'images/',
    region: 'us-east-1',
    acl: 'public-read'
  },

  cleanup: {
    versions: true,
    original: false
  },

  original: {
    awsImageAcl: 'private'
  },

  versions: [{
    maxHeight: 1040,
    maxWidth: 1040,
    format: 'jpg',
    suffix: '-large',
    quality: 80,
    awsImageExpires: 31536000,
    awsImageMaxAge: 31536000
  },{
    maxWidth: 780,
    aspect: '3:2!h',
    suffix: '-medium'
  },{
    maxWidth: 320,
    aspect: '16:9!h',
    suffix: '-small'
  },{
    maxHeight: 100,
    aspect: '1:1',
    format: 'png',
    suffix: '-thumb1'
  },{
    maxHeight: 250,
    maxWidth: 250,
    aspect: '1:1',
    suffix: '-thumb2'
  }]
});
```

### #upload(**string** `src`, **object** `opts`, **function** `cb`)

* **string** `src` - path to the image you want to upload

* **object** `opts`
  * **string** `awsPath` - override the path on AWS set through `opts.aws.path`
  * **string** `path` - set absolute path for uploaded image (disables random path)

* **function** `cb` - callback function (**Error** `err`, **object[]** `versions`, **object** `meta`)
  * **Error** `err` - `null` if everything went fine
  * **object[]** `versions` - original and resized images with path/location
  * **object** `meta` - metadata for original image

#### Example

```javascript
client.upload('/some/image.jpg', {}, function(err, versions, meta) {
  if (err) { throw err; }

  versions.forEach(function(image) {
    console.log(image.width, image.height, image.url);
    // 1234 4567 https://my-bucket.s3.amazonaws.com/path/ab/cd/ef.jpg
  });
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

## Collaborators

Individuals making significant and valuable contributions are made Collaborators
and given commit-access to the project. These individuals are identified by the
existing Collaborators and their addition as Collaborators is discussed as a
pull request to this project's README.md.

Note: If you make a significant contribution and are not considered for
commit-access log an issue or contact one of the Collaborators directly.

* Hans Kristian Flaatten (@Starefossen)
* Anthony Ringoet (@anthonyringoet)

## [MIT License](https://github.com/Turistforeningen/node-s3-uploader/blob/master/LICENSE)
