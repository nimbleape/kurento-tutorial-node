/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ws = new WebSocket('wss://' + location.host + '/one2many');
var video;
var webRtcPeer;
var cskApp;
var conference;
var sessionId;
var conferenceId;
var startConferenceRequest;
var pingRequest;
var userIdElement;
var userId = Date.now();

window.onload = function() {
	console = new Console();
	video = document.getElementById('video');

	document.getElementById('call').addEventListener('click', function() { presenter(); } );
	document.getElementById('viewer').addEventListener('click', function() { viewer(); } );
	document.getElementById('terminate').addEventListener('click', function() { stop(); } );
  userIdElement = document.getElementById('userId');
  userIdElement.addEventListener('change', function() { userId = userIdElement.value; });
  userIdElement.value = userId;
  initCSK();
}

function initCSK() {
// Inititalize callstats-kurento.
  cskApp = callstatskurento(
    YOUR_CALLSTATS_APP_ID,
    YOUR_CALLSTATS_SECRET,
    'user-' + userIsd
  );
}

window.onbeforeunload = function() {
	ws.close();
}

function updateIds(parsedMessage) {
  if (parsedMessage.sessionId && parsedMessage.sessionId !== sessionId) {
    sessionId = parsedMessage.sessionId;
  }

  if (parsedMessage.conferenceId && parsedMessage.conferenceId !== conferenceId) {
    conferenceId = parsedMessage.conferenceId;
  }
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
    case 'sessionStart':
      updateIds(parsedMessage);
      initCSK(userId);
      break;
    case 'presenterResponse':
      updateIds(parsedMessage);
      presenterResponse(parsedMessage);
      break;
    case 'viewerResponse':
      updateIds(parsedMessage);
      viewerResponse(parsedMessage);
      break;
    case 'stopCommunication':
      updateIds(parsedMessage);
      dispose();
      break;
    case 'iceCandidate':
      webRtcPeer.addIceCandidate(parsedMessage.candidate)
      break;
    case 'conferenceStarted':
      if (startConferenceRequest) {
        startConferenceRequest(parsedMessage.error, parsedMessage.conferenceId);
      }
      break;
    case 'conferenceEnded':
      break;
    case 'pong':
      updateIds(parsedMessage);
      if (pingRequest) {
        pingRequest();
      }
      break;
    default:
      console.error('Unrecognized message', parsedMessage);
	}
}

function presenterResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function startConference(callback) {
  callback = (typeof callback === 'function' ? callback : function() {});

  if (startConferenceRequest) {
    callback(new TypeError('Conference start already requested'));
    return;
  }

  var message = {
		id : 'startConference'
	};

  startConferenceRequest = function(err, conferenceId) {
    startConferenceRequest = undefined;
    callback(err, conferenceId);
  };

	sendMessage(message);
}

function ping(callback) {
  callback = (typeof callback === 'function' ? callback : function() {});

  if (pingRequest) {
    callback(new TypeError('Ping already requested'));
    return;
  }

  var message = {
		id : 'ping'
	};

  pingRequest = function() {
    pingRequest = undefined;
    callback();
  };

	sendMessage(message);
}

function presenter() {
	if (!webRtcPeer) {
    userIdElement.disabled = true;
		showSpinner(video);

		var options = {
			localVideo: video,
			onicecandidate : onIceCandidate
	  };

    startConference(function(err, conferenceId) {
      if (err) {
        hideSpinner(video);
        onError(err);
        return;
      }

      conference = cskApp.createConference(conferenceId);

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
        if(error) return onError(error);

        conference.handle(webRtcPeer);

        this.generateOffer(onOfferPresenter);
      });
    });
	}
}

function onError(error) {
	console.error(error);
}

function onOfferPresenter(error, offerSdp) {
    if (error) return onError(error);

	var message = {
		id : 'presenter',
		sdpOffer : offerSdp
	};
	sendMessage(message);
}

function viewer() {
	if (!webRtcPeer) {
    userIdElement.disabled = true;
		showSpinner(video);

		var options = {
			remoteVideo: video,
			onicecandidate : onIceCandidate
		}

    ping(function() {
      conference = cskApp.createConference(conferenceId);

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
        if(error) return onError(error);

        conference.handle(webRtcPeer);

        this.generateOffer(onOfferViewer);
      });
    });
	}
}

function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)

	var message = {
		id : 'viewer',
		sdpOffer : offerSdp
	}
	sendMessage(message);
}

function onIceCandidate(candidate) {
	   console.log('Local candidate' + JSON.stringify(candidate));

	   var message = {
	      id : 'onIceCandidate',
	      candidate : candidate
	   }
	   sendMessage(message);
}

function stop() {
	if (webRtcPeer) {
		var message = {
				id : 'stop'
		}
		sendMessage(message);
		dispose();
    userIdElement.disabled = false;
	}
}

function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	hideSpinner(video);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
