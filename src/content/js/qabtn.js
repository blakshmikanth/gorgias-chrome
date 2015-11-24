/**
 * quick-action button
 */

App.qaBtn = (function() {
    // the gorgias instance
    var g = this;

    var qaPositionInterval;
    var $qaBtn;
    var qaBtn;
    var $qaTooltip;
    var showQaTooltip;
    var tooltip;
    var currentWindow = window;
    var settings;

    var qaClass = 'gorgias-qa-btn';
    var qaShowClass = 'gorgias-show-qa-btn';
    var qaHideClass = 'gorgias-hide-qa-btn';
    var qaDropdownShowClass = 'qa-btn-dropdown-show';

    var showQaForElement = function (elem) {

        var show = true;

        // if the quick access button is focused/clicked
        if (elem.className.indexOf('gorgias-qa-btn') !== -1) {
            show = false;
        }

        // if the dialog search field is focused
        if (elem.className.indexOf('qt-dropdown-search') !== -1) {
            show = false;
        }

        // in case we're focusing children of a contenteditable
        // get the parent contenteditable
        elem = App.autocomplete.isEditable(elem);

        if(elem) {
            // check if the element is big enough
            // to only show the qa button for large textfields
            var metrics = elem.getBoundingClientRect();

            // only show for elements
            if (metrics.width < 100 || metrics.height < 80) {
                show = false;
            }
        }

        return show && elem;

    };

    var sendShowMessage = function(textfield) {
        var rect = textfield.getBoundingClientRect();
        var dimensions = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };

        window.top.postMessage({
            action: 'g-qabtn-show',
            textfield: dimensions
        }, '*');

        // First time a user uses our extension
        // we open the dialog automatically
        // (as if the button was clicked).
        if (settings && settings.qaBtn && settings.qaBtn.hasOwnProperty('shownPostInstall')) {
            if (!settings.qaBtn.shownPostInstall) {
                settings.qaBtn.shownPostInstall = true;
                Settings.set('settings', settings, function(){});

                window.top.postMessage({
                    action: 'g-dialog-completion',
                    source: 'button'
                }, '*');
            }
        }
    };

    var focusin = function(e) {
        // show the qabtn only on gmail and outlook
        // and allow on localhost, for testing
        if (
            (g.activePlugin !== g.plugins['gmail'] && g.activePlugin !== g.plugins['outlook']) && window.location.href.indexOf('http://localhost') === -1
        ) {
            return;
        }

        var textfield = showQaForElement(e.target);

        // only show it for valid elements
        if (!textfield) {
            return false;
        }

        // delay getting the textfield positions and showing the button
        // in case the app changes the textfield dimensions/position
        // on focus.
        // (eg. gmail changes the contenteditable size if you're editing
        // the CC field, but enter no addresses, and then focus the
        // message body)
        setTimeout(function() {
            sendShowMessage(textfield);
        }, 50);
    };

    var focusout = function(e) {
        window.top.postMessage({
            action: 'g-qabtn-hide'
        }, '*');
    };

    var click = function(e) {
        if(!e.target.classList.contains(qaClass)) {
            return;
        }

        currentWindow.postMessage({
            action: 'g-dialog-completion',
            source: 'button'
        }, '*');

        // send the `-completion-qa` event to the top window
        // so the qabtn doesn't hide when the dialog opens
        window.top.postMessage({
            action: 'g-dialog-completion-qa'
        }, '*');
    };

    var setPosition = function (textfield) {
        if(!qaBtn) {
            return;
        }

        var top;
        var left;

        // check if the active plugin has
        // custom quick action button positioning.
        if(typeof g.activePlugin.setBtnPosition === 'function') {
            var pluginPos = g.activePlugin.setBtnPosition(textfield);
            top = pluginPos.top;
            left = pluginPos.left;
        } else {
            // otherwise just position the button on the top-right
            // of the focused field.
            top = textfield.top + window.scrollX;
            left = textfield.left + window.scrollX;

            // move the quick access button to the right
            // of the textfield
            left += textfield.width - qaBtn.offsetWidth;

            var computedStyles = window.getComputedStyle(qaBtn);
            var btnMarginLeft = parseInt(computedStyles.getPropertyValue('margin-left'), 10);

            // if the element under the qa button is not the editor,
            // hide the qa button.
            // (eg. when the gmail compose window overlaps the reply box,
            // or when we scroll the content in the gmail compose window)
            // we also need to check children, in case elementFromPoint
            // returns a child of the contenteditable.
            var nodeUnderBtn = document.elementFromPoint(left + btnMarginLeft - 1, top);

            if(nodeUnderBtn !== document.activeElement && !document.activeElement.contains(nodeUnderBtn)) {
                document.body.classList.add(qaHideClass);
            } else {
                document.body.classList.remove(qaHideClass);
            }
        }

        // move the btn using transforms
        // for performance
        var transform = 'translate3d(' + left + 'px, ' + top + 'px, 0)';

        qaBtn.style.transform = transform;
        qaBtn.style.msTransform = transform;
        qaBtn.style.mozTransform = transform;
        qaBtn.style.webkitTransform = transform;
    };

    var show = function(res) {
        var textfield = res.data.textfield;
        currentWindow = window;

        // if the event came from an iframe,
        // find the iframe dom node where it came from,
        // get its positions and merge them with the textfield position
        if(window !== res.source) {
            var iframes = document.querySelectorAll('iframe');
            var i;
            for(i = 0; i < iframes.length; i++) {
                // found the iframe where the event came from
                if(iframes[i].contentWindow === res.source) {
                    // add the extra x/y to it
                    var rect = iframes[i].getBoundingClientRect();
                    textfield.left += rect.left;
                    textfield.top += rect.top;
                    break;
                }
            }

            // save the currentWindow, for which iframe the btn was shown
            // so we can post to this window, on btn click
            currentWindow = res.source;
        }

        document.body.classList.add(qaShowClass);
        setPosition(textfield);
    };

    var hide = function() {
        if(document.activeElement.classList.contains(qaClass)) {
            return;
        }

        document.body.classList.remove(qaShowClass);

        // stop the position recalculation interval, on focusout
        if(qaPositionInterval) {
            clearInterval(qaPositionInterval);
        }

    };

    var showDialog = function() {
        document.body.classList.add(qaDropdownShowClass);
    };

    var hideDialog = function() {
        document.body.classList.remove(qaDropdownShowClass);
    };

    var showTooltip = function(e) {
        if(!e.target.classList.contains(qaClass)) {
            return;
        }

        if (showQaTooltip) {
            clearTimeout(showQaTooltip);
        }

        showQaTooltip = setTimeout(function () {
            var padding = 14;
            var rect = $qaBtn.get(0).getBoundingClientRect();
            var top = rect.top - padding - tooltip.height + 'px';

            $qaTooltip.removeClass('gorgias-qa-tooltip-bottom');

            // check if we don't have enough space at the top
            if (rect.top < tooltip.height + padding) {
                top = rect.top + rect.height + padding + 'px';

                $qaTooltip.addClass('gorgias-qa-tooltip-bottom');
            }

            $qaTooltip.css({
                top: top,
                left: rect.left - tooltip.width + 28 + 'px'
            });

            $qaTooltip.show();
        }, 500);

    };

    var hideTooltip = function (e) {
        if(!e.target.classList.contains(qaClass)) {
            return;
        }

        clearTimeout(showQaTooltip);
        $qaTooltip.hide();
    };

    var dispatcher = function (res) {
        if(!res.data) {
            return;
        }

        if(res.data.action === 'g-qabtn-show') {
            show(res);
        }

        if(res.data.action === 'g-qabtn-hide') {
            // don't hide the button if the dialog is visible
            if (App.autocomplete.dialog.isActive) {
                return;
            }

            hide();
            // hide the dialog along with the button
            // in case it's open
            hideDialog();
        }

        if(res.data.action === 'g-dialog-completion-qa') {
            showDialog(res);
        }

        if(res.data.action === 'g-dialog-hide') {
            hideDialog(res);
        }
    };

    var create = function() {
        var $container = $(document.body);

        // add the dialog quick access icon
        $qaBtn = $(g.autocomplete.dialog.qaBtnTemplate);
        qaBtn = $qaBtn.get(0);
        $qaTooltip = $(g.autocomplete.dialog.qaBtnTooltip);

        $container.append($qaBtn);
        $container.append($qaTooltip);

        document.body.addEventListener('click', click);
        document.body.addEventListener('mouseover', showTooltip, true);
        document.body.addEventListener('mouseout', hideTooltip, true);

        tooltip = {
            height: parseInt($qaTooltip.css('height'), 10),
            width: parseInt($qaTooltip.css('width'), 10)
        };
    };

    // re-position the button, if visible, on scroll
    var positionOnScroll = function(e) {
        // only if the button is visible
        // and we're not scrolling the active element.
        if(!document.body.classList.contains(qaShowClass) || !document.activeElement || document.activeElement === e.target) {
            return;
        }

        // trigger a fake focus event, to trigger the positioning flow
        var focus = new Event('focus');
        document.activeElement.dispatchEvent(focus);
    };

    var init = function() {
        // only create the qa button in the top window
        if(!g.data.iframe) {
            create();
            window.addEventListener('message', dispatcher);
        }

        document.body.addEventListener('focus', focusin, true);
        document.body.addEventListener('blur', focusout, true);

        document.body.addEventListener('scroll', positionOnScroll, true);

        App.settings.fetchSettings(function(s) {
            settings = s;
        }, window.document);
    };

    return {
        init: init
    };
}).call(App);