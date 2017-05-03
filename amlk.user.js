// ==UserScript==
// @id				tldr
// @name			Hebrew tl;dr (amlk)
// @namespace		http://while1.co.il/amlk
// @version			1.2.0
// @author			Matan Mizrachi
// @description		View summarized version of articles (for facebook.com/this.is.amlk community)
// @require			https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @resource		amlkStyle https://while1.co.il/amlk/resources/style.css
// @resource		loadingImg https://while1.co.il/amlk/resources/loader.gif
// @match			*://news.while1.co.il/*
// @match			*://*.ynet.co.il/*
// @match			*://*.mynet.co.il/*
// @match			*://*.mako.co.il/*
// @match			*://*.holesinthenet.co.il/*
// @match			*://*.walla.co.il/*
// @match			*://*.one.co.il/*
// @match			*://*.sport5.co.il/*
// @match			*://*.bizportal.co.il/*
// @match			*://*.calcalist.co.il/*
// @match			*://*.geektime.co.il/*
// @match			*://*.globes.co.il/*
// @match			*://*.haaretz.co.il/*
// @match			*://*.israelhayom.co.il/*
// @match			*://*.maariv.co.il/*
// @match			*://*.nrg.co.il/*
// @match			*://*.rotter.net/*
// @match			*://*.themarker.com/*
// @match			*://*.ynetnews.com/*
// @match			*://*.reshet.tv/*
// @grant			GM_xmlhttpRequest
// @grant			GM_addStyle
// @grant			GM_getResourceText
// @grant			GM_getResourceURL
// @updateURL		https://while1.co.il/amlk/getScript.php?rel=autoUpdateCheck&v=1.2.0
// ==/UserScript==

/* IMPORTANT NOTE FOR MYSELF: don't change namespace! it's used to identify this script */

// load css
var newCSS = GM_getResourceText("amlkStyle");
GM_addStyle(newCSS);

// amlk class
var amlk = {
	
	logging				: false,
	url_api				: "http://tldr.guru/api/",
	clickbaitsPerHost	: {},
	loadedAmlks			: {},
	$amlk_bubble		: $("<div>אמ;לק</div>"),
	current_bubble_url	: "",
	bubble_hide_timer	: null,
	
	// initiate amlk magic
	init: function(){
		console.log("hello amlk");	// always log. let us know that the script is running
		
		this.getClickbaitsList();
		
		this.createBubble();
	},
	
	// ------------------------------------------------------------
	// GENERAL FUNCTIONS
	// ------------------------------------------------------------
	
	// logs for debugging
	log: function(data){
		if(this.logging){
			console.log(data);
		}
	},
	
	// return host part from a url (without 'www.')
	getHostPart: function(url){
		var url_parts = url.split("/");
		
		if(typeof(url_parts[2]) != "undefined"){
			return url_parts[2].replace("www." , "");
		}
		
		return "";
	},
	
	// load a url
	loadURL: function(the_url , success , fail){		
		this.log("loading url " + the_url);
		
		GM_xmlhttpRequest({
			method: "GET",
			headers: {"Accept": "application/json"},
			url: the_url,
			timeout: 10000,
			onload: function(response){
				if(typeof(response.responseText) == "string" && response.responseText != ""){
					if(typeof(success) == "function"){
						// callback for success function
						success(response.responseText);
					}
				}
				else {
					if(typeof(fail) == "function"){
						// callback for fail function
						fail();
					}
				}
			},
			ontimeout: function(response){
				if(typeof(fail) == "function"){
					// callback for fail function
					fail();
				}
			}
		});
	},
	
	// convert json to an array
	json2array: function(the_json){
		try {
			JSON.parse(the_json);
		}
		catch(e){
			// invalid input will return empty array
			return [];
		}
		
		return JSON.parse(the_json);
	},
	
	// escape html tags in a string
	escapeHTML: function(str){
		var escaped_text = str;
		escaped_text = escaped_text.replace("<" , "&lt;");
		escaped_text = escaped_text.replace(">" , "&gt;");
		
		return escaped_text;
	},
	
	// ------------------------------------------------------------
	// HANDLE ALL CLICKBAITS
	// ------------------------------------------------------------
	
	// load existing urls in amlk server
	getClickbaitsList: function(){
		var _this = this;
		this.loadURL(this.url_api + "allUrls/" , function(data){
			_this.prepareClickbaits(data);
		});
	},
	
	// prepare clickbaits,
	// then find & mark clickbaits for urls in this page
	prepareClickbaits: function(clickbaits_json){
		var clickbaits = this.json2array(clickbaits_json);
		
		if(clickbaits.length <= 0){
			this.log("there aren't clickbaits at all");
			return;
		}
		
		this.sortClickbaitsToHosts(clickbaits);
		this.findClickbaitsLinks();
	},
	
	// sort & group clickbaits by hosts (domains)
	sortClickbaitsToHosts: function(clickbaits_arr){
		this.log("sort clickbaits to hosts");
		
		this.clickbaitsPerHost = {};
		
		for(var cb = 0; cb < clickbaits_arr.length; cb++){
			var cb_host = this.getHostPart(clickbaits_arr[cb].url);
			
			// new host
			if(!this.isKnownHost(cb_host)){
				this.clickbaitsPerHost[ cb_host ] = [];
			}
			
			// new url
			if(!this.isKnownURLInHost(clickbaits_arr[cb].url , cb_host)){
				this.clickbaitsPerHost[ cb_host ].push(clickbaits_arr[cb].url);
			}
		}
	},
	
	// check if url is a clickbait (yes/no)
	isClickbait: function(url){
		// url must have at least 10 chars for "http://x.x"
		if(typeof(url) != "string" || url.length <= 10){
			return false;
		}
		
		var link_host = this.getHostPart(url);
		
		return (this.isKnownHost(link_host) && this.isKnownURLInHost(url , link_host));
	},
	
	// check if host exists in clickbaits-array
	isKnownHost: function(host){
		return (typeof(host) == "string" && host != "" && typeof(this.clickbaitsPerHost[ host ]) != "undefined");
	},
	
	// check if url exists in clickbaits-array (by host)
	isKnownURLInHost: function(url , host){
		return (this.clickbaitsPerHost[ host ].indexOf(url) !== -1);
	},
	
	// ------------------------------------------------------------
	// IN-PAGE CLICKBAITS
	// ------------------------------------------------------------
	
	// loop over links in the page to find & mark clickbaits
	findClickbaitsLinks: function(){
		this.log("searching clickbaits links");
		
		_this = this;
		var found_clickbaits = 0;
		
		$("a").each(function(i , el){
			if(_this.isClickbait(el.href)){
				_this.markLink($(this));
				found_clickbaits++;
			}
		});

		this.log("found " + found_clickbaits + " clickbaits");
	},
	
	// mark clickbait link
	markLink: function($linkEl){
		_this = this;
		
		$linkEl
			.css({"background-color" : "#E29E56" , "box-shadow" : "inset 0 0 10px #FF0000"})
			.on("mouseover"	, function(){ _this.showAmlkForLink(this); }) // pass dom element, not jquery
			.on("mouseout"	, function(){ _this.hideBubble(); });
			
		$linkEl.children().css({"background-color" : "#E29E56"});
		$linkEl.find("img").css({"outline" : "2px solid #DB7713"});
	},
	
	// ------------------------------------------------------------
	// HANDLE AMLKS (FOR A CLICKBAIT URL)
	// ------------------------------------------------------------
	
	// load amlks for clickbait url
	loadAmlk: function(url){
		this.log("loading amlk");
		
		if(!this.isClickbait(url)){
			this.log("unkwown clickbait url");
			_this.hideBubble();
			return;
		}
		
		// url already loaded and we have amlk stored?
		if(this.isExistsAmlk(url)){
			this.fetchAmlksToBubble(url);
			return;
		}
		
		// load new amlk data
		var _this = this;
		this.loadURL(this.url_api + "url/?url=" + encodeURIComponent(url),
			// on success
			function(data){
				_this.handleNewAmlkData(data , url);
				_this.fetchAmlksToBubble(url);
			},
			// on fail
			function(){
				_this.bubbleError("שגיאה: לא ניתן לטעון אמ;לק");
			}
		);
	},
	
	// prepare amlks,
	// store them and sort by score
	handleNewAmlkData: function(amlks_json , for_url){
		var amlks = this.json2array(amlks_json);
		
		if(amlks.length <= 0){
			this.log("there aren't amlks in response");
			return;
		}
		
		this.storeAmlks(amlks);
		this.sortAmlks(for_url);
	},
	
	// keep amlks for future use (for example: multiple hovers on the same clickbait)
	storeAmlks: function(amlk_arr){
		this.log("storing amlks");
		
		for(var a = 0; a < amlk_arr.length; a++){
			if(!this.isExistsAmlk(amlk_arr[a].url)){
				this.loadedAmlks[ amlk_arr[a].url ] = [];
			}
			
			// there isn't reason to store empty amlks
			// *but we stored the url, to prevent future loading*
			if(amlk_arr[a].amlk == ""){
				continue;
			}
			
			if(!this.isExistsAmlkId(amlk_arr[a].id , amlk_arr[a].url)){
				this.loadedAmlks[ amlk_arr[a].url ].push(amlk_arr[a]);
			}
		}
	},
	
	// sort amlks by score (DESC)
	sortAmlks: function(url){
		this.loadedAmlks[ url ].sort(function(a, b){
			return b.score - a.score;
		});
	},
	
	// check if url-amlks already stored
	isExistsAmlk: function(url){
		return (typeof(this.loadedAmlks[url]) != "undefined");
	},
	
	// check if specific amlk already stored
	isExistsAmlkId: function(id, url){
		for(var a = 0; a < this.loadedAmlks[url].length; a++){
			if(id == this.loadedAmlks[url][a].id){
				return true;
			}
		}
		
		return false;
	},
	
	// ------------------------------------------------------------
	// SHOW AMLKS IN BUBBLE
	// ------------------------------------------------------------
	
	// append amlks to the bubble, using stored data for url
	fetchAmlksToBubble: function(requested_url){
		this.log("fetch amlks to bubble");
		
		// user changed bubble view while amlks were loaded?
		if(this.current_bubble_url != requested_url){
			this.log("bubble already changed...");
			return;
		}
		
		if(typeof(this.loadedAmlks[ requested_url ]) == "undefined" || this.loadedAmlks[ requested_url ].length <= 0){
			this.bubbleError("שגיאה: אין אמ;לק להצגה");
			return;
		}
		
		this.clearBubble();
		
		for(var a = 0; a < this.loadedAmlks[ requested_url ].length; a++){
			this.addAmlkToBubble(this.loadedAmlks[ requested_url ][a]);
		}
	},
	
	// append an amlk to the bubble
	addAmlkToBubble: function(the_amlk){		
		if(the_amlk.amlk == ""){
			return;
		}
		
		var amlk_row = "";
		
		var negative_class = (parseInt(the_amlk.score) < 0)? "negative_score" : "";
		
		amlk_row += "<div class='amlk_row " + negative_class +"'>";
		amlk_row += "<span class='score'>" + parseInt(the_amlk.score) + "</span>";
		amlk_row += "<span class='amlk_txt'>" + this.escapeHTML(the_amlk.amlk) + "</span>";
		
		if(typeof(the_amlk.userName) == "string"){
			amlk_row += "<div class='user_row'>";
			amlk_row += "<span class='username'>" + this.escapeHTML(the_amlk.userName) + "</span>";
			amlk_row += "<span class='userscore'>(" + parseInt(the_amlk.userScore) + ")</span>";
			amlk_row += "</div>";
		}
		
		amlk_row += "<div class='clear'></div>";
		
		amlk_row += "</div>";
		
		this.$amlk_bubble.append(amlk_row);
	},
	
	// ------------------------------------------------------------
	// BUBBLE UI
	// ------------------------------------------------------------
	
	// create amlk-bubble
	createBubble: function(){
		_this = this;
		
		this.$amlk_bubble
			.attr("id" , "tldr_tooltip")
			.appendTo("body")
			.on("mouseover" , function(){ _this.dontHideBubble(); })
			.on("mouseout" , function(){ _this.hideBubble(); })
			.hide();
	},
	
	// remove bubble content
	clearBubble: function(){
		this.$amlk_bubble.html("");
	},
	
	// show loading icon in bubble
	bubbleIsLoading: function(){
		this.$amlk_bubble.html("<img class='loading' src='" + GM_getResourceURL('loadingImg') + "' alt='טוען...' />");
	},
	
	// show error msg in bubble
	bubbleError: function(msg){
		this.$amlk_bubble.html(msg);
	},
	
	// show amlk-bubble
	showBubble: function(){
		this.$amlk_bubble.fadeIn("fast");
		this.dontHideBubble();
	},
	
	// reset amlk-bubble timer, and hide when it's done
	hideBubble: function(){
		this.dontHideBubble();
		
		_this = this;
		this.bubble_hide_timer = setTimeout(function(){
			_this.$amlk_bubble.fadeOut("fast");
		} , 750);
	},
	
	// stop amlk-bubble hide timer
	dontHideBubble: function(){
		if(this.bubble_hide_timer){
			clearTimeout(this.bubble_hide_timer);
		}
	},
	
	// set amlk-bubble position
	attachBubbleToElement: function($element){
		var new_pos = {};
		
		if($element.offset().top - 70 < $(window).scrollTop()){
			new_pos.top = $element.offset().top + 5;
		}
		else {
			new_pos.top = $element.offset().top - 70;
		}

		if($element.offset().left - this.$amlk_bubble.innerWidth() - 5 < 0){
			new_pos.left = $element.offset().left + $element.innerWidth() + 5;
		}
		else {
			new_pos.left = $element.offset().left - this.$amlk_bubble.innerWidth() - 10;
		}

		this.$amlk_bubble.css(new_pos);
	},
	
	// ------------------------------------------------------------
	// AMLK ACTIONS
	// ------------------------------------------------------------
	
	// attach & show bubble to link element,
	// load amlk data
	showAmlkForLink: function(linkElement){
		var link_url = linkElement.href;
		
		// prevent multiple loads from multiple hovers on elements with the same url
		if(this.current_bubble_url != link_url){
			this.current_bubble_url = link_url;
			this.bubbleIsLoading();
			this.loadAmlk(link_url);
		}
		
		// move bubble to current element
		this.attachBubbleToElement($(linkElement));
		this.showBubble();
	}
}

// start here
amlk.init();