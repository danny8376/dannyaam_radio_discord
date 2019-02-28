const { Readable } = require('stream');
const http = require('http');
const ogg = require('ogg');

class Upstream {
    constructor(uri) {
        this.uri = uri;
        this.http = null;
        this.id = 0;
		this.connections = []; // {id, connection, dispatcher}
        this.sequence = 0;
        this.timestamp = 0;
        this.last = 0;

        this.connect();
        setInterval(() => {
            if (this.http) {
                if (Date.now() - this.last > 5000) {
                    this.last = Date.now();
                    console.log("stuck? retry");
                    this.disconnect();
                    this.connect();
                }
            }
        }, 1000);
    }

    on(connection) {
        const dummy = new Readable();
        dummy._read = (size) => {};
        const dispatcher = connection.playOpusStream(dummy);
        this.connections[this.id] = {
            id: this.id,
            connection: connection,
            dispatcher: dispatcher
        };
        return this.id++;
    }

    off(id) {
        delete this.connections[id];
    }

    step() {
        this.last = Date.now();
        this.sequence = this.sequence < 65535 ? this.sequence + 1 : 0;
        this.timestamp = (this.timestamp + 960) < 4294967295 ? this.timestamp + 960 : 0;
    }

    connect() {
        this.http = http.get(this.uri, (res) => {
	        const decoder = new ogg.Decoder();
	        decoder.on('stream', (stream) => {
	            stream.on('data', packet => {
	                // ignore start/end packet to avoid stuck with discord streaming
	                if (packet.e_o_s === 0 && packet.b_o_s === 0) {
	                    this.step();
                        this.connections.forEach((connection) => {
	                        connection.dispatcher.sendBuffer(null, this.sequence, this.timestamp, packet.packet);
                        });
	                }
	            });
	        });
	        res.pipe(decoder);
	    });
    }

    disconnect() {
        this.http.abort();
        this.http = null;
    }
}

module.exports = Upstream;
