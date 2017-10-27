
(function(_exports) {
"use strict";

const RTCPeerConnectionMethods = [/*"getStats",*/ "setConfiguration", "close", "createOffer", "createAnswer", "setLocalDescription", "setRemoteDescription", "addIceCandidate", "getReceivers", "createDataChannel", "getLocalStreams", "getRemoteStreams", "getStreamById", "addStream", "removeStream", "createDTMFSender", "addEventListener", "removeEventListener", "dispatchEvent"];
const RTCPeerConnectionMembers = ["ontrack", "localDescription", "remoteDescription", "signalingState", "iceGatheringState", "iceConnectionState", "onnegotiationneeded", "onicecandidate", "onsignalingstatechange", "oniceconnectionstatechange", "onicegatheringstatechange", "ondatachannel", "onaddstream", "onremovestream"];

//const log = console.log.bind(console, 'RTCPeerConnectionInspector');
let loggedMessages = [];
function log() {
  loggedMessages.push(arguments);
};

const RTCPeerConnectionInspector = _exports.RTCPeerConnectionInspector = function RTCPeerConnectionInspector(pc) {
  log('constructor()');
  this.__peerConnection = pc;
}

const proto = RTCPeerConnectionInspector.prototype = {
  outputCapturedLogEntries(fn) {
    if (!fn) {
      fn = console.log.bind(console);
    }

    const _loggedMessages = loggedMessages;
    loggedMessages = [];
    _loggedMessages.forEach((logEntry) => fn.apply(null, logEntry));
  },

  getStats(...args) {
    const p = this.__peerConnection.getStats(callback);
    log('method getStats', ...args);
    return p;

    function callback(stats) {
      log('returned', 'getStats', getPropertyNames(stats), stats.result());
      return args[0](stats);
    }
  },

  outputCapturedLog(fn) {
    if (!fn) {
      fn = console.log.bind(console);
    }

    const _loggedMessages = loggedMessages;
    loggedMessages = [];
    fn(_loggedMessages);
  }
};

RTCPeerConnectionInspector.wrapPeer = function wrapPeer(webRtcPeer) {
  const pc = webRtcPeer.peerConnection;
  const _pc = new RTCPeerConnectionInspector(pc);

  const peer = Object.create(webRtcPeer);

  Object.defineProperty(peer, 'peerConnection', {
    get: function() { return _pc; },
    set: function() {},
    enumerable: true,
    configurable: false
  });

  return peer;
}

RTCPeerConnectionMethods.forEach((name) => makeDummyFunction(name));
RTCPeerConnectionMembers.forEach((name) => makeDummyMember(name));

function makeDummyFunction(methodName) {
  proto[methodName] = function() {
    log('method', methodName, arguments);
    const pc = this.__peerConnection;
    const value = pc[methodName].apply(pc, arguments);
    log('returned', methodName, value);
    return value;
  };
}

function makeDummyMember(name) {
  Object.defineProperty(proto, name, {
    get: function() {
      let value = this.__peerConnection[name];
      log('getter', name, value);
      return value;
    },
    set: function(value) {
      log('setter', name, value);
      this.__peerConnection[name] = value;
    },
    enumerable: true,
    configurable: false
  });
}

function getMethodNames(obj) {
  const names = getPropertyNames(obj);
  return names.filter((name) => typeof obj[name] === 'function');
}

function getMemberNames(obj) {
  const names = getPropertyNames(obj);
  return names.filter((name) => typeof obj[name] !== 'function');
}

function getPropertyNames(obj) {
  if (obj && typeof obj === 'object') {
    const names = Object.getOwnPropertyNames(obj);
    const proto = Object.getPrototypeOf(obj);

    const protoNames = getPropertyNames(proto);

    if (protoNames.length) {
      let _protoNames = protoNames.filter((name) => names.indexOf(name) === -1);

      return names.concat(_protoNames);
    } else {
      return names;
    }
  } else {
    return [];
  }
};

})(window);