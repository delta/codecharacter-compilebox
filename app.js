const express = require('express');
const path = require('path');
const favicon = require('static-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const childProcess = require('child_process');
//impotrt from somewhere
const zlib = require('zlib');

const secretKey = require('./config.js').configKey;
const appPort = require('./config.js').port;

const app = express();
const fs = require('fs');
const pako = require('pako');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json({limit:'50mb'}));
app.use(bodyParser.urlencoded({limit:'50mb'}));
app.use(cookieParser());

app.post('/dummt', function(req, res) {
  //console.log(req.body);
  res.end('hey, thanks');
})
//dummy route
app.post ('/compile', (req, res)=> {

    let userId = req.body.user_id;
    let code = req.body.code;
    //console.log(userId);
//    fs.rmdir('')
    try{
        fs.stat('./compilebox_transaction', (err, stats) => {
          if(err) {
            console.log(err);
            //console.log(err);
            return res.json({success: false});
          }
          if(stats.isDirectory()){
            childProcess.exec('rm -rf ./compilebox_transaction && mkdir compilebox_transaction && mkdir compilebox_transaction/dlls && mkdir compilebox_transaction/source', (err, stdout, stderr) => {
              //console.log(err, stdout, stderr, 'lpg');
              fs.writeFile('./compilebox_transaction/source/player_code.cpp', code, (err) => {
                if (err) throw err;
                //prepare
                childProcess.exec(
                  `
                    docker run -v $(pwd)/compilebox_transaction/dlls:/root/output_libs -v $(pwd)/compilebox_transaction/source:/root/codecharacter/src/player_code/src -t deltanitt/codecharacter-compiler:latest
                  `,
                  (error, stdout, stderr) => {
                    console.log(stdout, stderr);
                    if(req.body.secretString != secretKey){
                        return res.json({code: 404, message:"Bad request!"});
                    }
                    //let respo
                    let dll1 = fs.readFileSync('./compilebox_transaction/dlls/libplayer_1_code.so');
                    let dll2 = fs.readFileSync('./compilebox_transaction/dlls/libplayer_2_code.so');
                    //console.log(dll1.length, dll1_decompressed.length);
                    if (error) {
                      console.error(`exec error: ${error}`);
                      return;
                    }
                    //console.log(`stdout: ${stdout}`);
                    //console.log(`stderr: ${stderr}`);
                    res.setHeader('scores', '0+56');

                    res.setHeader('user_id', userId);
                    stdout = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                    if(stdout.toLowerCase().indexOf('error') != -1){
                      return res.json({
                        success: false,
                        error: stdout
                      });
                    }
                    return res.json({
                      success: true,
                      dll1,
                      dll2
                    });
                });
            });
            });


          }
        })
    }catch(e){
        console.log(e, 'Please make compilebox directory manually!');
    }
});
app.post ('/execute', (req, res)=> {
    let matchId = req.body.matchId;
    let dll1 = new Buffer.from(req.body.dll1);
    let dll2 = new Buffer.from(req.body.dll2);
    //dll1 = Buffer.from(dll1, 'base64');
    //dll2 = Buffer.from(dll2, 'base64');
    try{
        fs.stat('./executebox_transaction', (err, stats) => {
            if(err) {
                //console.log(err);
                return res.json({success: false});
            }
            if(stats.isDirectory()){
                childProcess.execSync('rm -rf ./executebox_transaction && mkdir executebox_transaction && mkdir executebox_transaction/dlls && mkdir executebox_transaction/output_log');
                //fs.writeFileSync('./executebox_transaction/dlls/libplayer_1_code.so', dll1);
                //fs.writeFileSync('./executebox_transaction/dlls/libplayer_2_code.so', dll2);
                fs.writeFile(__dirname+'/executebox_transaction/dlls/libplayer_1_code.so', dll1, (err) => {
                    if (err) throw err;
                    fs.writeFile(__dirname+'/executebox_transaction/dlls/libplayer_2_code.so', dll2, (err) => {
                        if(err) throw err;
                        //prepare
                        childProcess.exec(
                                `
                                docker run -v $(pwd)/executebox_transaction/dlls:/root/input_libs -v $(pwd)/executebox_transaction/output_log:/root/output_log -t deltanitt/codecharacter-runner:latest
                                `,
                                (error, stdout, stderr) => {
                                    console.log(error, stdout, stderr);
                                    let stdoutArray = stdout.split('\n');
                                    let results = stdoutArray[stdoutArray.length-2];
                                    if(results.indexOf("UNDEFINED") != -1){
                                        return res.json({
                                            success: true,
                                            log:'', 
                                            matchId, 
                                            results, 
                                            player1LogCompressed:'', 
                                            player2LogCompressed:''
                                        })
                                    }
                                    if(stdout.toLowerCase().indexOf('error') != -1){
                                        return res.json({
                                            success: false,
                                            error: stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''),
                                            matchId
                                        });
                                    }

                                    if (error || stderr) {
                                        //console.log(error, stdout, stderr);
                                        console.error(`exec error: ${error}`);
                                        return res.json({
                                            success: false,
                                            error: stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''),
                                            matchId
                                        });
                                    }

                                    let log = fs.readFileSync('executebox_transaction/output_log/game.log');
                                    let logCompressed = zlib.gzipSync(log);
                                    //console.log(results);

                                    let player1Log = fs.readFileSync('./executebox_transaction/output_log/player_1.dlog');
                                    let player2Log = fs.readFileSync('./executebox_transaction/output_log/player_2.dlog');
                                    let player1LogCompressed = zlib.gzipSync(player1Log);
                                    let player2LogCompressed = zlib.gzipSync(player2Log);
                                    //let dll_compressed2 = zlib.gzipSync(dll2);
                                    //console.log(player1Log.length, player1LogCompressed.length, 'hey');
                                    //let dll1_decompressed = zlib.unzipSync(player1LogCompressed);
                                    //console.log(dll1_decompressed.length);
                                    //console.log(score1, score2);

                                    res.json({success: true, log: logCompressed, matchId, results, player1LogCompressed, player2LogCompressed});
                                });
                    })
                });
            }
        })
    }catch(e){
        console.log(e, "Please make executebox directory manually!");
    }
});

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    //console.log(err);
    next(err);
});


app.listen(appPort);
