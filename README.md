node-s3-uploader
================

Resize, rename, and upload images to AWS S3

## Usage

```javascript
var Upload = require('s3-uploader');
var client = new Upload('my_s3_bucket', {
  path: '/images'                       // path to store images inside the bucket
  url: 'https://some.domain.com/images' // publicly accessible url 
  resize: [780, 320]
  keepOriginal: true
});
```

### Upload

```javascript
client.upload('/tmp/some/file', function(err, images) {
  if (err) {
    console.error(err);
  } else {
    for (var i = 0; i < images.length; i++) {
      console.log('Thumbnail with width %i, height %i, at %s', images[i].width, images[i].height, images[i].url);
    }
  }
});
```
