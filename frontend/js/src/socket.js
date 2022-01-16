class MessSocket {
	version = 'v1.1.0';
	socket;
	endpoint = '';
	hooks = {};
	requestNum = 0;

	static domainWsAddress() {
		let proto = '';
		switch(location.protocol) {
			case 'http:':  proto = 'ws';  break;
			case 'https:': proto = 'wss'; break;
			default:
				alert('Unknown protocol, aborting.');
		}
		return `${proto}://${location.host}/ws`;
	}

	constructor() {
		this.endpoint = MessSocket.domainWsAddress();
		this.hooks = {
			open:    [],
			close:   [],
			error:   [],
			message: [],
		}

		// Create the websocket this application will use.
		this.socket = new WebSocket(this.endpoint);

		// Call the hooks for each event.
		this.socket.onopen = (evt)=>
			this.hooks.open.forEach(hook=>hook(evt));

		this.socket.onclose = (evt)=>
			this.hooks.close.forEach(hook=>hook(evt));

		this.socket.onerror = (evt)=>
			this.hooks.error.forEach(hook=>hook(evt));

		this.socket.onmessage = (evt)=>this.onMessage(evt);
	}

	addHook(type, func) {
		if(this.hooks[type] === undefined)
			throw "Unknown hook type";

		this.hooks[type].push(func);
	}

	send(req) {
		this.requestNum++;
		req.requestId = this.requestNum.toString();
		//req.requestId = crypto.randomUUID();
		this.socket.send(JSON.stringify(req));
	}

	onMessage(evt) {
		let msg = JSON.parse(evt.data)
		if(msg.Version !== this.version) {
			alert(
				`Frontend version ${this.version} != `+
				`server version ${msg.Version}`,
			);
			return;
		}
		this.hooks.message.forEach(hook=>hook(msg));
	}
}
