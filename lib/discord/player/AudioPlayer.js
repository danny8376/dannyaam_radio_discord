const EventEmitter = require('events').EventEmitter;
const Prism = require('prism-media');
const StreamDispatcher = require('../dispatcher/StreamDispatcher');
const Collection = require('discord.js').Collection;

/**
 * An Audio Player for a Voice Connection.
 * @private
 * @extends {EventEmitter}
 */
class AudioPlayer extends EventEmitter {
  constructor(voiceConnection) {
    super();
    /**
     * The voice connection that the player serves
     * @type {VoiceConnection}
     */
    this.voiceConnection = voiceConnection;
    /**
     * The prism transcoder that the player uses
     * @type {Prism}
     */
    this.prism = new Prism();
    this.streams = new Collection();
    this.currentStream = {};
    this.streamingData = {
      channels: 2,
      count: 0,
      sequence: 0,
      timestamp: 0,
      pausedTime: 0,
    };
    this.voiceConnection.once('closing', () => this.destroyCurrentStream());
  }

  /**
   * The current transcoder
   * @type {?Object}
   * @readonly
   */
  get transcoder() {
    return this.currentStream.transcoder;
  }

  /**
   * The current dispatcher
   * @type {?StreamDispatcher}
   * @readonly
   */
  get dispatcher() {
    return this.currentStream.dispatcher;
  }

  destroy() {
    if (this.opusEncoder) this.opusEncoder.destroy();
    this.opusEncoder = null;
  }

  destroyCurrentStream() {
    const transcoder = this.transcoder;
    const dispatcher = this.dispatcher;
    if (transcoder) transcoder.kill();
    if (dispatcher) {
      const end = dispatcher.listeners('end')[0];
      const error = dispatcher.listeners('error')[0];
      if (end) dispatcher.removeListener('end', end);
      if (error) dispatcher.removeListener('error', error);
      dispatcher.destroy('end');
    }
    this.currentStream = {};
    this.streamingData.pausedTime = 0;
  }

  /**
   * Set the bitrate of the current Opus encoder.
   * @param {number} value New bitrate, in kbps
   * If set to 'auto', the voice channel's bitrate will be used
   */
  setBitrate(value) {
    if (!value) return;
    if (!this.opusEncoder) return;
    const bitrate = value === 'auto' ? this.voiceConnection.channel.bitrate : value;
    this.opusEncoder.setBitrate(bitrate);
  }

  playUnknownStream(stream, options = {}) {
    options.opus = true;
    this.destroyCurrentStream();
    if (options.bitrate) this.setBitrate(options.bitrate);
    const dispatcher = this.createDispatcher(stream, options);
    this.currentStream = {
      dispatcher,
      input: stream,
      output: stream,
    };
    return dispatcher;
  }

  createDispatcher(stream, { seek = 0, volume = 1, passes = 1 } = {}) {
    const options = { seek, volume, passes };

    const dispatcher = new StreamDispatcher(this, stream, options);
    dispatcher.on('end', () => this.destroyCurrentStream());
    dispatcher.on('error', () => this.destroyCurrentStream());
    dispatcher.on('speaking', value => this.voiceConnection.setSpeaking(value));
    return dispatcher;
  }
}

module.exports = AudioPlayer;
