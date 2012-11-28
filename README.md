#extend

``` js
	var extend = require('extend');
	var http = require('http');

	http.createServer( extend.listener ).listen(1337);
```

## metody:

### extend.paths (url,function)
* **url** - url jak '/' dla czystego adresu.
* **function** - arguments: [url.parse(req.url)], this wskazuje na response, this.request dla zapytania.

użycie:
``` js
	extend.paths('/',function( data,  response){
		console.log(data);    //--> url.query(dla GET) lub form ( object , node-formidable patrz: node-formidable https://github.com/blackhunter/node-formidable)
		// this.res == response
		// this.res.req == request
		this.write('hello');  //standardowe metody
		this.end();
	});
```

### extend.cookie (name,options)
* **name** - identyfikator szablonu
* **options** - {}
	* **path** - ścieżka '/'
	* **domain** - domena
	* **http** - true albo false
	* **object** - true albo false, parse JSON
	* **secure** - zabezpieczenie, wartość klucza szyfrującego
	* **expire** - czas ważności

## nowe metody argumentu response

> getC jak getCookie, ciasteczka są szyfrowane o ile wstawimy klucz w opcjach szablonu options.secure

### response.getC (name)
* **name** - identyfikator szablonu

### response.setC (name,data)
* **name** - identyfikator szablonu
* **data** - dane będące zawarte w ciasteczkach

### response.format (ext)
* **ext** - rozszerzenie wiadomości.

``` js
	html: 'text/html',
	txt: 'text/plain',
	css: 'text/css',
	csv: 'text/csv',
	rss: 'application/rss+xml',
	xml: 'application/xml',
	js: 'application/javascript',
	json: 'application/json'
```

### response.error (num[,msg])
* **num** - wartość błędu jak: 404, 530, ...
* **msg** - opcjonalny tekst

> w przypadku błędu headers są kasowane o ile nie zostały wysłane,
> a funcja sprawdza czy istnieje extend.paths ('/error/404). Innaczej zostaje wysłana wiadomość tekstowa domyślna lub wskazana w argumenicie, argument jest również przekazywany jako jedyny do extend.paths()

### response.cache (fun,pub)
* **fun** - identyfikator, jeżeli typu Date określa wartość nagłówka 'Last-Modified' innaczej 'ETag'
* **pub** - jeżeli true, publiczny