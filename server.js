var express = require('express');
var app = express();
var fs = require('fs');
var cronJob = require('cron').CronJob;
var request = require('request');

var PORT = 4567;
var apID = 6098753;

var log4js = require('log4js');

var logger = confLog(log4js);

console.log("Server lisetening in port " + PORT);
app.listen(PORT);

var job = new cronJob('*/8 * *  *  *  *', MainBot);
job.start();

num = 0
function MainBot(){

	num = num+1;
	console.log("Cron job, call num "+num);
	console.log("Making request to VK");
	getUnanswered((messages)=>{
		console.log("Got messages>");console.log(messages);

		messages.forEach(function(el) {
			m = el.body;
			if ((m != "")&&(el.chat_id==null)) {
				console.log("Making request to bot for message " + el.id);
				getBotAnswer(el.user_id,m, (repl) => {
					answer = repl.fulfillment.speech;
					console.log("answer from ai id " + el.id + " >" + JSON.stringify(repl));
					console.log("answer is " + answer + " Sending...\n");
					console.log(el.user_id);

					//if(repl.action!="input.unknown")
					sendMsg(el.user_id,answer,(res)=>{
						 console.log("Message >" + answer + "< sent!\n");
					});
					
				});
			}
			else{
				console.log("empty body")
			}
		});
	});
}

//

//   ***----API.AI----***
function getBotAnswer(sid,msg, callback) {
	var apiurl = "https://api.api.ai/v1/query";
//	var sid = 42;
	var apitoken = loadlocalapitoken();
	qs = {
		v: "20150910",
		sessionId: sid,
		lang: "ru",
		query: encodeURI(msg)
	}
	headers = {	
		Authorization: "Bearer "+apitoken
	}
	console.log("--Talking with AI"); //debug
	request({url:apiurl,qs:qs,headers:headers},(err,res,body)=>{
		console.log("---->"+JSON.stringify(res)); //debug
		if(!err){
			answer = JSON.parse(body);
			if(answer.status.code==200){
				callback(answer.result);
			}else{
				console.log(answer);
			}
		}else{
			console.log(err);
			logger.err(err);
		}
	});
}

function loadlocalapitoken(){
	return fs.readFileSync('.aitoken').slice(0, -1).toString();
}

//  ***----VK messages----***

function sendMsg(id, text, callback) {
	qs = {
		user_id: id,
		message: (text)
	}
	var url = "https://api.vk.com/method/messages.send";
	var token = loadlocaltoken();
	qs.access_token = token;
	qs.v = "5.65"
	request({ url: url, qs: qs }, (err, res, body) => {
		if (err) { console.log("error sending message"); }
		else {
			var answ = JSON.parse(body);
			if (answ.error == null) {
				callback(body);
			} else {
				console.log("vk returned error");
				console.log(answ.error);
			}
		}
	});
}

function getUnanswered(callback) {
	getMsg({ out: 0, count: 5 }, function (inmsg) {
		offst = Math.floor(Date.now() / 1000);
		inmsg.forEach(i => {
			if (i.date < offst) offst = i.date;
		});
		offst = Math.floor(Date.now() / 1000) - offst;
		getMsg({ out: 1, count: 20,time_offset: offst }, function (outmsg) {
			console.log("--finding unanswered vk msg"); //debug
			result = inmsg.filter(function (i) {
					// For each incomming message :
					var out_from_same = outmsg.filter(o => (o.user_id==i.user_id));
					if(out_from_same.length==0){
						return true;
					}
					else{
						var out_later_then_in = out_from_same.filter(o=>(o.date>i.date));
						return out_later_then_in.length == 0;
					}
			});	//res
			callback(result);
		});
	});
}

function getMsg(qs, callback) {
	var url = "https://api.vk.com/method/messages.get";
	var token = loadlocaltoken();
	qs.access_token = token;
	qs.v = "5.65"
	console.log("--Getting vk messages"); //debug
	request({ url: url, qs: qs }, function (err, res, body) {
//		console.log("---->"+body); //debug
		if (err) { console.log(err); logger.err(err); }
		else {
			console.log(body)
			var answ = JSON.parse(body);
			if (answ.error == null) {
				callback(answ.response.items);
			}
		}
	});
}


//  ***----VK authentification----***
function vkauth(res) {
	//var redir = "http://vk.cotr.me/vk/blank.html";
	var redir = "https://oauth.vk.com/blank.html"
	var frnd = 2;
	var messages = 4096;
	var offline = 65536;
	var mask = frnd + messages + offline;

	var codeurl = "https://oauth.vk.com/authorize" +
		"?client_id=" + apID + "&display=page&redirect_uri=" +
		redir + "&scope=" + mask + "&response_type=token";

	res.redirect(codeurl);
}

function loadlocaltoken() {
	return fs.readFileSync('.vktoken').slice(0, -1).toString();
}


// ***----Web Server stuff----***
app.get('/log', function (req, res) {
	try {
		console.log("reading log")
		res.send(fs.readFileSync('.log'))
	}
	catch (e) { res.send(e) }
});
app.get('/', function (req, res) {
	logger.info(req.query);
	try {
		console.log("giving html")
		res.set('Content-Type', 'text/html');
		res.send(fs.readFileSync('index.html'));
	}
	catch (e)
	{ res.send(e) }
});
app.get('/vk/Login', function (req, res) {
	console.log(req.query);
	logger.info(req.query);
	// TODO: store all data
	vkauth(res);

});

// ***----UTILS----***
function confLog(log4js) {
	log4js.clearAppenders();
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file('.log'), 'serv');

	var logger = log4js.getLogger('serv');
	logger.setLevel(log4js.levels.ALL);
	return logger
}
