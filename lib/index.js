// static cache

var paths = {},
	url = require('url'),
	formidable = require('formidable'),
	mime = {
		html: 'text/html',
		txt: 'text/plain',
		css: 'text/css',
		csv: 'text/csv',
		rss: 'application/rss+xml',
		xml: 'application/xml',
		js: 'application/javascript',
		json: 'application/json'
	},
	statuses = {
		100 : 'Continue',
		101 : 'Switching Protocols',
		102 : 'Processing', // RFC 2518, obsoleted by RFC 4918
		200 : 'OK',
		201 : 'Created',
		202 : 'Accepted',
		203 : 'Non-Authoritative Information',
		204 : 'No Content',
		205 : 'Reset Content',
		206 : 'Partial Content',
		207 : 'Multi-Status', // RFC 4918
		300 : 'Multiple Choices',
		301 : 'Moved Permanently',
		302 : 'Moved Temporarily',
		303 : 'See Other',
		304 : 'Not Modified',
		305 : 'Use Proxy',
		307 : 'Temporary Redirect',
		400 : 'Bad Request',
		401 : 'Unauthorized',
		402 : 'Payment Required',
		403 : 'Forbidden',
		404 : 'Not Found',
		405 : 'Method Not Allowed',
		406 : 'Not Acceptable',
		407 : 'Proxy Authentication Required',
		408 : 'Request Time-out',
		409 : 'Conflict',
		410 : 'Gone',
		411 : 'Length Required',
		412 : 'Precondition Failed',
		413 : 'Request Entity Too Large',
		414 : 'Request-URI Too Large',
		415 : 'Unsupported Media Type',
		416 : 'Requested Range Not Satisfiable',
		417 : 'Expectation Failed',
		418 : 'I\'m a teapot', // RFC 2324
		422 : 'Unprocessable Entity', // RFC 4918
		423 : 'Locked', // RFC 4918
		424 : 'Failed Dependency', // RFC 4918
		425 : 'Unordered Collection', // RFC 4918
		426 : 'Upgrade Required', // RFC 2817
		428 : 'Precondition Required', // RFC 6585
		429 : 'Too Many Requests', // RFC 6585
		431 : 'Request Header Fields Too Large',// RFC 6585
		500 : 'Internal Server Error',
		501 : 'Not Implemented',
		502 : 'Bad Gateway',
		503 : 'Service Unavailable',
		504 : 'Gateway Time-out',
		505 : 'HTTP Version not supported',
		506 : 'Variant Also Negotiates', // RFC 2295
		507 : 'Insufficient Storage', // RFC 4918
		509 : 'Bandwidth Limit Exceeded',
		510 : 'Not Extended', // RFC 2774
		511 : 'Network Authentication Required' // RFC 6585
	}

exports.listener = function(req,res){
	res.req = req;
	var post = (req.method=='POST'),
		href = url.parse(req.url,!post),
		data;

	if(!paths[href.pathname])
		res.error(404);

	if(post){
		data = new formidable.IncomingForm();
		data.parse(req);
	}else{
		data = href.query;
	}

	paths[href.pathname].call(res,data,res);
}

exports.paths = function(name,fuu){
	paths[name] = fuu;
}

/**===cookie backend===*/
var self = {
	schema: {}
};
exports.cookie = function(name,options){
	if(arguments.length==1){
		options = name;
		name = 'default';
	}
	var parts = '';

	if(options.path)
		parts += '; path='+options.path;
	if(options.domain)
		parts += '; domain='+options.domain;
	if(options.http)
		parts += '; HttpOnly';

	self.schema[name] = [escape(name)+'=','',parts,!!options.object,options.secure,options.expire];
	forceSynch(name);
};
var forceSynch = function(name){
	var msNow = Date.now();
	self.dateNow = msNow;

	function newExpire(name){
		if(self.schema[name][5])
			self.schema[name][1] = '; expires='+new Date(msNow+self.schema[name][5]).toUTCString();
	}

	if(name){
		newExpire(name);
	}else{
		for(var i in self.schema){
			newExpire(i);
		}
	}
}
setInterval(forceSynch,1000);

exports.extend = function(http){
	/**===cookie===*/
	var crypto = require('crypto'),
		decrypt = function(secret, str){
			var decipher = crypto.createDecipher("aes192", secret);
			return decipher.update(str, 'hex', 'utf8') + decipher.final('utf8');
		},
		encrypt = function(secret, str){
			var cipher = crypto.createCipher("aes192", secret);
			return cipher.update(str, 'utf8', 'hex') + cipher.final('hex');
		},
		hmac = function(secret, data, time){
			var hmac = crypto.createHmac('sha1', secret);
			hmac.update(time + data);
			return hmac.digest('hex');
		},
		deserialize = function(secret, code, name){
			var time = parseInt(code.slice(0, 13), 10),
				hmac_sign = code.slice(13,53),
				code = code.slice(53);

			if(self.schema[name][5] && time+self.schema[name][5] < self.dateNow)
				return false;

			if(hmac_sign!=hmac(secret, code, time))
				return false;

			return decrypt(secret, code);
		},
		serialize = function(secret, data){
			var enc = encrypt(secret, data),
				time = self.dateNow,
				hmac_sign = hmac(secret, enc, time),
				result = time + hmac_sign + enc;

			if(result.length >= 4096){
				throw new Error('data too long to store in a cookie');
			}

			return result;
		},
		update = function(name,code,arr){
			var time = parseInt(code.slice(0, 13), 10),
				hmac_sign = code.slice(13,53),
				code = code.slice(53),
				now = self.dateNow,
				secret = self.schema[name][4],
				schema = self.schema[name];

			if(self.schema[name][5] && time+self.schema[name][5] < now)
				return false;

			if(hmac_sign!=hmac(secret, code, time))
				return false;

			arr.push(schema[0] + now + hmac(secret, code, now) + code + schema[1] + schema[2]);
		}

	var select = function(int,curr){
			var params = curr.split('=');
			params[0] = unescape(params[0]);

			if(self.schema[params[0]]){
				try{
					if(self.schema[params[0]][4]){
						if(!int.secure)
							int.secure = {};
						int.secure[params[0]] = params[1];
						params[1] = deserialize(self.schema[params[0]][4],params[1],params[0]);
					}

					if(self.schema[params[0]][3]){
						params[1] = JSON.parse(params[1]);
					}else{
						params[1] = unescape(params[1]);
					}

					if(params[1])
						int.out[params[0]] = params[1];
				}catch(e){
					return int;
				}
			}
			return int;
		},
		req = new RegExp('([^\\s\\=]+)\\=([^\\s;]+)','g');

	http.ServerResponse.prototype.setC = function(name,value){
		var cookies = this.cookies || (this.cookies=[]),
			schema = self.schema[(name)? name : 'default'];

		if(!schema)
			return false;

		if(schema[3])
			value = JSON.stringify(value);
		if(schema[4]){
			value = serialize(schema[4],value);
			if(this.secure && this.secure[name])
				delete this.secure[name];
		}else
			value = escape(value);

		cookies.push(schema[0]+value+schema[1]+schema[2]);
	};
	http.ServerResponse.prototype.getC = function(name){
		var cookie = this.req.headers.cookie,
			ret = {secure:false,out:{}};
		if(!cookie)
			return ret;
		else if(name)
			select(ret,cookie.match(new RegExp(escape(name)+'\\=([^\\s;]+)'))[0]);
		else
			cookie.match(req).reduce(select,ret);

		if(ret.secure)
			this.secure = ret.secure;

		return ret.out;
	};
	/**===cookie end===*/

	/**===methods===*/
	var _end = http.ServerResponse.prototype.end;
	http.ServerResponse.prototype.end = function(data,encoding){
		if(!this.content)
			this.format('txt');
		else if(this.content==='json')
			data = JSON.stringify(data);

		if(!this.chunked){
			if(!data){
				if(this.statusCode==200)
					this.statusCode = 204;
			}else
				this.setHeader('Content-Length', Buffer.byteLength(data));
		}
		_end.call(this,data,encoding);
	}

	var _write = http.ServerResponse.prototype.write;
	http.ServerResponse.prototype.write = function(chunk,encoding){
		this.chunked = true;

		/**cookie subpart*/
		if(!this._headerSent){
			var cookies = this.cookies || [];

			for(var i in this.secure){
				update(i,this.secure[i],cookies);
			}
			this.setHeader('Set-Cookie',cookies.join('\r\nSet-Cookie:'));
		}

		if(!this.content)
			this.format('txt');
		else if(this.content==='json')
			chunk = JSON.stringify(chunk);

		_write.call(this,chunk,encoding);
	}

	http.ServerResponse.prototype.format = function(ext){
		if(ext in mime){
			this.setHeader('Content-Type', mime[ext] + '; charset=UTF-8');
			this.content = ext;
		}else
			console.error('Unknown data format');
	}
	http.ServerResponse.prototype.error = function(status,msg){
		this.statusCode = status;
		this._headers = {};
		this._headerNames = {};

		if(paths['error/'+status])
			paths['error/'+status].call(this,msg);
		else{
			this.setHeader('Content-Type','text/plain; charset=UTF-8');
			this.end((msg)? msg : statuses[status]);
		}
	}

	http.ServerResponse.prototype.content = null;
	http.ServerResponse.prototype.chunked = false;
	/**===methods end===*/

	/**===cache===*/
	var mod = function(since,mod){
			since = new Date(since);
			if(isNaN(since.getTime()))
				return false;
			else
				return since>=mod;
		},
		match = function(etag,ntag){
			return ~etag.match(ntag);
		};

	http.ServerResponse.prototype.cache = function(fuu,pub){
		var res = this;

		if(!fuu){
			res.setHeader('Cache-Control','no-cache');
			res.setHeader('Pragma','no-cache');
		}else{
			if((this.req.header['if-modified-since'] && mod(this.req.header['if-modified-since'],fuu)) || (this.req.header['if-none-match'] && match(this.req.header['etag'],fuu))){
				res.writeHead(304);
				res.end();
				return true;
			}else{
				if(fuu instanceof Date)
					res.setHeader('Last-Modified', fuu.toUTCString());
				else
					res.setHeader('ETag', escape(fuu));

				res.setHeader('Cache-Control',(pub? 'public' : 'private')+', max-age=' + config.maxAge);
				return false;
			}
		}
	};
	/**===cache end===*/
}