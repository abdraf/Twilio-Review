//SOCKET IO SETUP
$(document).ready(function () {
	
//TWILIO
'use strict';


var Video = Twilio.Video; //require('twilio-video');

var activeRoom;
var previewTracks;
var identity;
var roomName;
var userName;
var myTracks;
var isTwilio = false;
var isVideoEnabled = true;
var isAudioEnabled = true;


//IDs
var leaveButtonID = 'leave-room'; //leave room button
var joinButtonID = 'button-join'; //join meeting button
var localMediaContainerID = 'meeting-preview'; //local media container
var remoteMediaContainerID = 'meeting-attendee'; //remote media container
var eccountabilityID = $('#id').val();


//Make a data object
var tData = {};
tData.userid = $('#id').val();
tData.email = $('#email').val();
tData.username = (($('#username').val() == '') ? $('#fullname').val() : $('#username').val());
tData.is_admin = $('#is_admin').val();
tData.role = $('#my_role').val();
var datastr = 'room='+$('#meeting_key').val()+'&'+$.param(tData);


//Twilio token end point --- node server that recives the data as query string. Needed for chat etc.
var tokenendpoint = "https://eccountability.io:3001/token?"+datastr;


// Attach the Tracks to the DOM.
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    container.appendChild(track.attach());
  });
}

// Attach the Participant's Tracks to the DOM.
// type is 0 or 1, local or remote participant
// this creates a container for the participant depending on the type, and does the relevant html/css work
function attachParticipantTracks(participant, container, type) {
	var cID = "";
    
	if (type==1) {
		var userObjData = JSON.parse('{"' + decodeURI(participant.identity.replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
		var userinfoDIV = document.createElement('div');
		userinfoDIV.id = participant.identity;
		userinfoDIV.setAttribute('data-pid', participant.identity);
		userinfoDIV.setAttribute('data-user-id', userObjData.userid);
		userinfoDIV.className = 'col-md-2 user-video meeting-attendees-content role-icon';
		userinfoDIV.innerHTML = '<div class="remote" id="remote-' + participant.identity + '"><span class="name" style="z-index:10;">' + userObjData.username + '</span>' +
						'</div><button class="btn btn-custom show-goal" type="button" data-toggle="collapse" data-target="#collapse-' + userObjData.userid + '" aria-expanded="false" aria-controls="collapse-' + userObjData.userid + '" data-userid="' + userObjData.userid + '">Show Goals / Progress</button> <div class="edit-goals-notetaker"><span class="notetaker-goalediticon goal-editor' + userObjData.userid + '" onclick="editGoalsByNotetaker(' + userObjData.userid + ');" style="display:none" >EDIT GOAL</span></div> <div class="collapse" id="collapse-' + userObjData.userid + '"><div class="well attendees-moreinfo"></div></div>' || '<img src="/frontend/images/avatars/' + window.btoa(userObjData.email) + '/avatar.jpeg" class="img-responsive" />';
		$(container).append(userinfoDIV);
		 cID = "remote-" + participant.identity;
	 } else {
		$(container).attr("data-pid", participant.identity);    
		cID = "meeting-preview";
	 }
	 
	  var newcontainer = document.getElementById(cID); 
	  var tracks = Array.from(participant.tracks.values());
	  attachTracks(tracks, newcontainer);
}

// Detach the Tracks from the DOM.
function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}



//refresh remote participant
function refreshRemoteParticipant(participant){
    
    var tracks = Array.from(participant.tracks.values());
    detachTracks(tracks);    

    var previewContainer = document.getElementById(remoteMediaContainerID);
    attachParticipantTracks(participant, previewContainer, 1);
    
}


// When we are about to transition away from this page, disconnect from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);

// Obtain a token from the server in order to connect to the Room.
function startTwilio() {
    
    $('#meeting-attendee').html('');
    
	//disconnect if already connected
    if (activeRoom) {
        activeRoom.disconnect();
    }

	
	//send ajax request to token endpoint
    $.getJSON(tokenendpoint, function(data) {
    
      identity = data.identity;
    	roomName = $('#meeting_key').val();
    	userName = $('#fullname').val(); 
    
    	var connectOptions = {
    			name: roomName,
    			logLevel: 'debug',
    			pname: userName
    	};
    
    	if (previewTracks) {
    			connectOptions.tracks = previewTracks;
    	}
    
    	// Join the Room with the token from the server and the LocalParticipant's Tracks.
    	Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
    	});
    	
    
      // Bind button to leave Room.
      document.getElementById(leaveButtonID).onclick = function() {
        activeRoom.disconnect();
      };
	  
    });
	
}

// called when successfully connected
function roomJoined(room) {
    
    
    isTwilio = true;
 
	//video / audio controls
  $('#video-control').removeClass('hide-element');
  $('#mute-me').removeClass('hide-element');


	// video hide / unhide listener, iwth socket io code
  $('#video-control').on('click', function(event) {
    var $obj = $(this);  
    room.localParticipant.tracks.forEach(function(track, trackid) {
       if (track.kind=='video')
        {  
          if (track.isEnabled) {
            track.disable();
            isVideoEnabled=false;
            socket.emit('hide-unhide', {action: 'hide'});
			$obj.html('<div><img src="/frontend/images/ic_show.png"></div> Show');
			$('#meeting-preview').children('video').css('display', 'none');
			$('#meeting-preview').css('background', "url('/frontend/images/avatars/" + window.btoa($('#email').val()) + "/avatar.jpeg') no-repeat").css('background-size', 'cover');
          } else {
            track.enable();
            isVideoEnabled=true;
            socket.emit('hide-unhide', {action: 'unhide'});
			$obj.html('<div><img src="/frontend/images/ic_hide.png"></div> Hide');
			$('#meeting-preview').children('video').css('display', '');
			//$('#localprofimg').remove();
          }
        }
    })
  });


	//mute / unmute listener, with socket io code
  $('#mute-me').on('click', function(event) {
    var $obj = $(this);  
    room.localParticipant.tracks.forEach(function(track, trackid) {
        if (track.kind=='audio') {  
          if (track.isEnabled) {
            track.disable();
            isAudioEnabled = false;
			$obj.html('<div><img src="/frontend/images/ic_loud.png"></div>Unmute Me');
            socket.emit('mute-unmute', {action: 'mute'});
          } else {
            track.enable();
            isAudioEnabled = true;
            $obj.html('<div><img src="/frontend/images/ic_mute.png"></div>Mute Me');
            socket.emit('mute-unmute', {action: 'unmute'});
          }
        }
    })
    
    
  });

  window.room = activeRoom = room;


  // Attach LocalParticipant's Tracks, if not already attached.
  var previewContainer = document.getElementById(localMediaContainerID);
  if (!previewContainer.querySelector('video')) {
    attachParticipantTracks(room.localParticipant, previewContainer, 0);
  }

  // Attach the Tracks of the Room's Participants.
  room.participants.forEach(function(participant) {
    var previewContainer = document.getElementById(remoteMediaContainerID);
    attachParticipantTracks(participant, previewContainer, 1);
  });

  
  room.on('participantConnected', function(participant) {
  });

  
  // When a Participant adds a Track, attach it to the DOM.
  room.on('trackAdded', function(track, participant) {
  
    var cID = "remote-" + participant.identity;
	var previewContainer = document.getElementById(cID); 

	
	// create a preview container for this participant if it does not exist, app specified code
	if (!previewContainer) {
			var userObjData = JSON.parse('{"' + decodeURI(participant.identity.replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
			var userinfoDIV = document.createElement('div');
			userinfoDIV.id = participant.identity;
			userinfoDIV.setAttribute('data-pid', participant.identity);
		 	userinfoDIV.setAttribute('data-user-id', userObjData.userid);
			userinfoDIV.className = 'col-md-2 user-video meeting-attendees-content role-icon';
			userinfoDIV.innerHTML = '<div class="remote" id="remote-' + participant.identity + '"><span class="name">' + userObjData.username + '</span>' +
				'</div><button z-index="10" class="btn btn-custom show-goal" type="button" data-toggle="collapse" data-target="#collapse-' + userObjData.userid + '" aria-expanded="false" aria-controls="collapse-' + userObjData.userid + '" data-userid="' + userObjData.userid + '">Show Goals / Progress</button> <div class="edit-goals-notetaker"><span class="notetaker-goalediticon goal-editor' + userObjData.userid + '" onclick="editGoalsByNotetaker(' + userObjData.userid + ');" style="display:none" >EDIT GOAL</span></div> <div class="collapse" id="collapse-' + userObjData.userid + '"><div class="well attendees-moreinfo"></div></div>' || '<img src="/frontend/images/avatars/' + window.btoa(userObjData.email) + '/avatar.jpeg" class="img-responsive" />';

			$("#meeting-attendee").append(userinfoDIV);
			cID = "remote-" + participant.identity;
			previewContainer =  document.getElementById(cID);
	}
    
    attachTracks([track], previewContainer);
        
  });

  // When a Participant removes a Track, detach it from the DOM.
  room.on('trackRemoved', function(track, participant) {
    detachTracks([track]);
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on('participantDisconnected', function(participant) {
    $("[data-pid='"+participant.identity+"']").remove();
    detachParticipantTracks(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on('disconnected', function() {
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    activeRoom = null;
  });


}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}

startTwilio(); // call this function to initiate the whole process

});
