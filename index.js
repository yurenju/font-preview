var Canvas = require('canvas')
var request = require('request');
var opentype = require('opentype.js')
var async = require('async');
var fs = require('fs');
require('shelljs/global');


var fontList;
const FONT_LIST_URL = 'https://www.googleapis.com/webfonts/v1/webfonts' +
    '?key=AIzaSyA3kwtZ3B6r-rmaiXxLHOjVJagRul1BhK4';
var badFonts = [];

mkdir('-p', 'images');
mkdir('-p', 'fonts');

request(FONT_LIST_URL, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    fontList = JSON.parse(body);
    var tasks = fontList.items.map(function(item) {
      return function(callback) {
        console.log('working on ' + item.family);
        var url = item.files.regular ? item.files.regular : item.files[Object.keys(item.files)[0]];
        var filename = 'fonts/' + item.family + '.ttf';
        request(url).pipe(fs.createWriteStream(filename)).on('close', function() {
          opentype.load(filename, function(err, font) {
            // var canvas = new Canvas(250, 36)
            var canvas = new Canvas(500, 100);
            var ctx = canvas.getContext('2d');
            if (err) {
              console.log('got error from load function', err);
              badFonts.push(item.family);
              exec('convert -fill black -size 250x36 -pointsize 36 ' +
                            '-background None -font "' + filename + '" ' +
                            'label:"' + item.family + '" ' +
                            '"images/' + item.family + '.png"');
              return callback();
            }
            try {
              font.draw(ctx, item.family, 2, 38, 36);
            } catch (err) {
              console.log('got error from font.draw', err);
              badFonts.push(item.family);
              exec('convert -fill black -size 250x36 -pointsize 36 ' +
                            '-background None -font "' + filename + '" ' +
                            'label:"' + item.family + '" ' +
                            '"images/' + item.family + '.png"');
              return callback();
            }

            cropCanvas(ctx, canvas);

            var out = fs.createWriteStream('images/' + item.family + '.png');
            var stream = canvas.pngStream();

            stream.on('data', function(chunk){
              out.write(chunk);
            });
            stream.on('end', function(){
              callback();
            });

          });
        });

      };
    });
    async.series(tasks, function() {
      console.log('badFonts', badFonts);
    });
  }
});

/**
 * Crop canvas to contents
 *
 * http://stackoverflow.com/a/22267731/740836
 *
 * @param  {context} ctx   Canvas Context
 * @param  {canvas} canvas HTML5 Canvas element
 * @return {undefined}
 */
function cropCanvas(ctx, canvas) {
  var w = canvas.width;
  var h = canvas.height;
  var pix = {x:[], y:[]};
  var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
  var x, y, index;

  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      index = (y * w + x) * 4;
      if (imageData.data[index+3] > 0) {
        pix.x.push(x);
        pix.y.push(y);
      }
    }
  }

  pix.x.sort(function(a,b){return a-b});
  pix.y.sort(function(a,b){return a-b});

  var n = pix.x.length-1;

  w = (pix.x[n] - pix.x[0]) + 2;
  h = (pix.y[n] - pix.y[0]) + 2;

  var cut = ctx.getImageData(pix.x[0], pix.y[0], w, h);

  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(cut, 0, 0);
}


