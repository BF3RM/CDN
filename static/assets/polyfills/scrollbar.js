(function (factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(global);
    } else {
        return factory(window);
    }
})(function (global) {
    const KeyboardKeys = {
        UpArrow: 38,
        DownArrow: 40,
        RightArrow: 39,
        LeftArrow: 37,
        Home: 36,
        End: 35,
    };

    const ERRORS = new Map([
        ['type_object', () => {
            return 'Wrong options parameter type - options must be an object!';
        }],
        ['type_array', (key) => {
            return `Custom element's ${key} option cannot be an Array!`;
        }],
        ['type_string_or_Element', (selector) => {
            return `Option ${selector} should be either a string (css selector), an HTMLElement instance or an object. Please provide a valid ${selector}.`;
        }],
        ['missing_mandatory_key', (key) => {
            return `Scrollbar initialized without mandatory key ${key}.
                    Perhaps you forgot to pass arguments to the create method?
                    Example: Scrollbar.create(options)`;
        }]
    ]);

    const STYLES = ':root { --scroll-track-padding: 0.4vh;    --scroll-thumb-width: 18px;    --scroll-width: 20px;    --dark-grey: #787878;} .coh-scrollbar-hidden{display: none;} .content-padding {padding-right: var(--scroll-width);}.scrollable-container {    overflow: hidden;}.scrollable-content--vertical {    max-height: 100%;    overflow-y: scroll;}.scrollable-content--horizontal {    width: 100%;    max-width: 100%;    overflow-x: scroll;}.coh-scrollbar-track {    position: absolute;    background-color: #f1f1f1;}.coh-scrollbar--vertical {    top: 0;    bottom: 0;    right: 0;    width: var(--scroll-width);    height: 100%;}.coh-scrollbar--horizontal {    bottom: 0;    left: 0;    right: 0;    width: 100%;    height: var(--scroll-width);}.coh-scrollbar-thumb {    position: relative;    top: 0px;    left: 0px;    height: 20px;    background-color: #c1c1c1;    cursor: pointer;}.coh-scrollbar-thumb:hover {    background-color: #a8a8a8;    cursor: pointer;}.coh-scrollbar-thumb--active:hover {    background-color: var(--dark-grey);}.coh-scrollbar-thumb--active {    background-color: var(--dark-grey);}.coh-scrollbar-thumb--vertical {    min-height: 1.4vh;}.coh-scrollbar-thumb--horizontal {    min-width: 1.4vh;}';
    const MANDATORY_OPTIONS_KEY = 'selector';
    const minSizePercentage = 0.025;

    class Helpers {
        static addStyles() {
            const styleTag = document.createElement('style');
            styleTag.textContent = STYLES;
            document.getElementsByTagName('head')[0].appendChild(styleTag);
        }

        static addClasses(element, classNames) {
            if (Helpers.isArray(classNames) && typeof classNames !== 'string') {
                return this.showError(`classNames should be either an Array of stings or a string`);
            }

            const classNamesArray = Helpers.isArray(classNames) ? classNames : classNames.split(' ');

            for (let className of classNamesArray) {
                element.classList.add(className);
            }
        }

        static isOfAllowedTypes(option) {
            if (typeof option !== 'string'
                && typeof option !== 'object'
                && !Helpers.isArray(option)
                && !Helpers.isHTMLElement(option)) {
                return false;
            }
            return true;
        }

        static isArray(option) {
            return option instanceof Array;
        }

        static isHTMLElement(element) {
            return element instanceof HTMLElement;
        }
    }

    class Delay {
        /**
         * Invokes a function after a given number of frames.
         * @param {Function} callback - The callback that will be executed after a given number of frames.
         * @param {number} [count = 1] - Number of frames after which the call will be executed.
         * @param {any[]} [callbackArguments] - Arguments that have to be passed to the callback.
         */
        static byFrame(callback = (...params) => { }, count = 1, ...callbackArguments) {
            if (count === 0) {
                return callback(...callbackArguments);
            }

            count--;

            requestAnimationFrame(() => {
                this.byFrame(callback, count, ...callbackArguments);
            });
        }
    }

    class Scrollbar {
        get currentScrollOnScrollAreaInPixels() {
            if (this.isVertical) {
                return this.scrollArea.scrollTop;

            } else {
                return this.scrollArea.scrollLeft;
            }
        }

        set currentScrollOnScrollAreaInPixels(value) {
            if (this.isVertical) {
                this.scrollArea.scrollTop = value;

            } else {
                this.scrollArea.scrollLeft = value;
            }
        }

        get maxScrollOnScrollAreaInPixels() {
            if (this.isVertical) {
                return this.scrollArea.scrollHeight;

            } else {
                return this.scrollArea.scrollWidth;
            }
        }

        get activeCssPositionProp() {
            if (this.isVertical) {
                return 'top';

            } else {
                return 'left';
            }
        }

        get activeCssSizeProp() {
            if (this.isVertical) {
                return 'height';

            } else {
                return 'width';
            }
        }

        getActiveDimension(domRect) {
            if (this.isVertical) {
                return domRect.height;

            } else {
                return domRect.width;
            }
        }

        /**
         * Retrieves the padding of the scroll.
         *
         * NOTE: Currently works only with uniform padding and VH units.
         * @return {number}
         */
        getPaddingInPixels() {
            return parseFloat(getComputedStyle(this.scrollbarTrack).paddingLeft) / 100 * window.innerHeight;
        }

        /**
         * Converts the mouse coordinates to a scroll percentage.
         * @param {MouseEvent} mouseEvent
         * @return {number}
         */
        mouseCoordinatesToScroll(mouseEvent) {
            this.scrollAreaRect = /** @type {DOMRect} */ (this.scrollArea.getBoundingClientRect());

            if (this.isVertical) {
                return (mouseEvent.clientY - this.scrollAreaRect.y + this.thumbDelta.y) / this.scrollAreaRect.height;

            } else {
                return (mouseEvent.clientX - this.scrollAreaRect.x + this.thumbDelta.x) / this.scrollAreaRect.width;
            }
        }

        /**
         * @param {HTMLElement} elementRef
         * @param {Object} manager
         */
        constructor(elementRef, manager, options) {
            Helpers.addStyles();
            // wrapper
            this.elementRef = elementRef;

            const automatic = elementRef.hasAttribute('automatic');
            if (automatic) this.initMutationObserver();

            // wrapper
            // items
            this.items = elementRef.querySelector(options.contentSelector);
            this.items.classList.add('content-padding');
            // items

            this.manager = manager;
            // scrollable-container
            this.scrollContainer = document.createElement('div');
            const scrollClassList = this.scrollContainer.classList;
            scrollClassList.add('scrollable-container');
            scrollClassList.add('scrollable-container--vertical');
            // scrollable-container

            // scrollable-content
            this.scrollArea = document.createElement('div');
            const scrollAreaClassList = this.scrollArea.classList;
            scrollAreaClassList.add('scrollable-content');
            scrollAreaClassList.add('scrollable-content--vertical');
            // scrollable-content

            this.scrollContainer.appendChild(this.scrollArea);
            this.isVertical = options.isVertical || true;

            elementRef.appendChild(this.scrollContainer);

            this.scrollArea.appendChild(this.items);


            this.initDom(this.scrollContainer, options);
            this.scrollbarTrack = /** @type {HTMLElement} */(this.scrollContainer.querySelector('.coh-scrollbar-track'));
            this.scrollbarThumb = /** @type {HTMLElement} */(this.scrollContainer.querySelector('.coh-scrollbar-thumb'));
            this.elementRef.appendChild(this.scrollContainer);


            /**
             * @type {Array | NodeListOf<HTMLElement>}
             */
            this.scrollableItemAll = [];
            this.scrollableItemSelector = '';

            this.scrollPosition = 0;
            this.thumbDelta = {
                x: 0,
                y: 0
            };

            this.scrollStep = 0.01;
            this.scrollableAreaSize = 0;
            this.scrollableItemSize = 0;
            this.scrollableContentSize = 0;

            /**
             * @type {DOMRect}
             */
            this.thumbRect = null;

            /**
             * @type {DOMRect}
             */
            this.scrollAreaRect = null;
            this.thumbSize = 0;

            this.boundSetScrollData = (shouldSetScrollPosition = true) => {
                this.setScrollBoundaries();
                this.setScrollableItem();

                if (shouldSetScrollPosition) {
                    this.setScrollThumbPosition();
                } else {
                    this.scrollTo(this.scrollPosition);
                }
            };

            this.resizeScrollThumb();
            this.attachEventListeners();
        }

        initMutationObserver() {
            if (this.observer) this.removeMutationObserver();
            this.observer = new MutationObserver(() => {
                Delay.byFrame(() => {
                    this.onUpdate();
                }, 3);
            });

            const options = {
                attributes: true,
                subtree: true,
                childList: true,
                attributesFilter: ['style', 'class'],
            };

            this.observer.observe(this.elementRef, options);
        }

        removeMutationObserver() {
            this.observer.disconnect();
            this.observer = null;
        }

        setScrollableItem() {
            this.scrollableItemAll = this.items.children;
            this.scrollableItem = this.scrollableItemAll[0];

            if (this.scrollableItem) {
                const itemRect = this.scrollableItem.getBoundingClientRect();

                this.scrollableItemSize = this.getActiveDimension(itemRect);
                this.scrollableItemRatio = this.scrollableItemSize / this.scrollableContentSize;
            }
        }

        /**
         * On update lifecycle hook.
         */
        onUpdate() {
            this.resizeScrollThumb();
        }

        /**
         * Attaches all event listeners for the component.
         */
        attachEventListeners() {
            this.scrollbarTrack.addEventListener('click', e => e.stopImmediatePropagation());
            // Scroll
            this.scrollArea.addEventListener('scroll', () => {
                this.manager.activeComponent = this;
                const newScrollPos = this.currentScrollOnScrollAreaInPixels / this.maxScrollOnScrollAreaInPixels;
                this.scrollTo(newScrollPos);
            });

            // Clicking on the scrollbar container
            this.scrollbarTrack.addEventListener('mousedown', (event) => {
                this.manager.activeComponent = this;
                const scrollPercentage = this.mouseCoordinatesToScroll(/** @type {MouseEvent}*/(event));
                this.scrollTo(scrollPercentage);
            });


            // Dragging the scroll widget
            this.scrollbarThumb.addEventListener('mousedown', (event) => {
                let mouseEvent = /** @type {MouseEvent} */(event);
                this.manager.activeComponent = this;
                this.scrollbarThumb.classList.add('coh-scrollbar-thumb--active');
                this.isDraggingScroll = true;

                const thumbRect = /** @type {DOMRect} */(this.scrollbarThumb.getBoundingClientRect());

                this.thumbDelta.x = thumbRect.x - mouseEvent.clientX;
                this.thumbDelta.y = thumbRect.y - mouseEvent.clientY;
            });

            this.scrollbarThumb.addEventListener('mouseleave', () => {
                if (!this.isDraggingScroll) {
                    this.scrollbarThumb.classList.add('coh-scrollbar-thumb--hover-off');
                }
            });
        }

        /**
         * Initializes the scrollbar track and thumb.
         * @param {HTMLElement} root
         */
        initDom(root, options) {
            const scrollbar = document.createElement('div');
            scrollbar.classList.add('coh-scrollbar-track');
            const directionClass = this.isVertical ? 'coh-scrollbar--vertical' : 'coh-scrollbar--horizontal';
            scrollbar.classList.add(directionClass);
            if (options.trackClassName) {
                Helpers.addClasses(scrollbar, options.trackClassName);
            }

            const scrollbarWidget = document.createElement('div');
            scrollbarWidget.classList.add('coh-scrollbar-thumb');
            const directionClassWidget = this.isVertical ? 'coh-scrollbar-thumb--vertical' : 'coh-scrollbar-thumb--horizontal';
            scrollbarWidget.classList.add(directionClassWidget);
            if (options.thumbClassName) {
                Helpers.addClasses(scrollbarWidget, options.thumbClassName);
            }

            scrollbar.appendChild(scrollbarWidget);
            root.insertBefore(scrollbar, this.scrollArea);

            /** @type {any} */(root).__CLComponent__ = this;
            Delay.byFrame(() => {
                root.__CLComponent__.resizeScrollThumb();
            }, 3);
        }

        /**
         * Shows the scrollbar
         */
        show() {
            this.items.classList.add('content-padding');
            this.scrollbarTrack.classList.remove('coh-scrollbar-hidden');
        }

        /**
         * Hides the scrollbar
         */
        hide() {
            this.items.classList.remove('content-padding');
            this.scrollbarTrack.classList.add('coh-scrollbar-hidden');
        }

        /**
         * On key down we scroll by the needed amount.
         * @param {KeyboardEvent} event
         */
        onKeydown(event) {
            if (event.target instanceof HTMLTextAreaElement) {
                this.setScrollThumbPosition();
                return;
            }

            if (event.keyCode === KeyboardKeys.Home) {
                this.scrollTo(0);
                return;
            }

            if (event.keyCode === KeyboardKeys.End) {
                this.scrollTo(1);
                return;
            }

            const verticalScroll = Number(event.keyCode === KeyboardKeys.DownArrow) - Number(event.keyCode === KeyboardKeys.UpArrow);
            const horizontalScroll = Number(event.keyCode === KeyboardKeys.RightArrow) - Number(event.keyCode === KeyboardKeys.LeftArrow);

            const scrollChange = this.isVertical ? verticalScroll : horizontalScroll;

            if (scrollChange == 0) {
                return;
            }

            const selectedItemIndex = this.getSelectedItemIndex();

            if (this.scrollableItem && selectedItemIndex != -1 && !this.isSelectedItemInView(selectedItemIndex)) {
                let scrollInPX = 0;
                if (scrollChange > 0) {
                    // Case when we scroll down
                    scrollInPX = (selectedItemIndex + 1) * this.scrollableItemSize - this.scrollableAreaSize;
                } else {
                    // Case when we scroll up
                    scrollInPX = selectedItemIndex * this.scrollableItemSize;
                }

                const scrollPercentage = scrollInPX / this.scrollableContentSize;

                this.scrollTo(scrollPercentage);

            } else if (this.scrollableItem && selectedItemIndex == -1) {
                this.scrollTo(this.scrollPosition + scrollChange * this.scrollableItemRatio);

            } else if (!this.scrollableItem) {
                this.scrollTo(this.scrollPosition + scrollChange / 100);
            }
        }

        getSelectedItemIndex() {
            const scrollableItemAllLength = this.scrollableItemAll.length;
            for (let i = 0; i < scrollableItemAllLength; i++) {
                if (this.scrollableItemAll[i].classList.contains(Scrollbar.SELECTED_ITEM_CLASS)) {
                    return i;
                }
            }

            return -1;
        }

        /**
         * @param {number} selectedItemIndex
         * @return {boolean}
         */
        isSelectedItemInView(selectedItemIndex) {
            return this.scrollableItemSize * selectedItemIndex >= this.currentScrollOnScrollAreaInPixels
                && this.scrollableItemSize * (selectedItemIndex + 1) - this.currentScrollOnScrollAreaInPixels < this.scrollableAreaSize;
        }

        /**
         * Scrolls to a given percentage.
         * @param {number} position - Position in percentage - from 0 to 1.
         */
        scrollTo(position) {
            this.scrollPosition = this.clamp(position, 0, this.maxScroll);
            const thumbScrollPosition = this.clamp(position, 0, this.maxThumbPosition);

            // Here ~~ is a faster alternative to Math.floor
            const scrollPositionInPixels = ~~(this.maxScrollOnScrollAreaInPixels * this.scrollPosition);

            this.currentScrollOnScrollAreaInPixels = scrollPositionInPixels;
            this.scrollbarThumb.style[this.activeCssPositionProp] = (thumbScrollPosition * 100) + '%';
        }

        setScrollThumbPosition() {
            this.scrollPosition = this.currentScrollOnScrollAreaInPixels / this.maxScrollOnScrollAreaInPixels;
            const thumbScrollPosition = this.clamp(this.scrollPosition, 0, this.maxThumbPosition);

            this.scrollbarThumb.style[this.activeCssPositionProp] = (thumbScrollPosition * 100) + '%';
        }

        /**
         * On mouse move we move the thumb if needed.
         * @param {MouseEvent} event
         */
        onMouseMove(event) {
            if (this.isDraggingScroll) {
                const scrollPercentage = this.mouseCoordinatesToScroll(event);
                this.scrollTo(scrollPercentage);
            }
        }

        /**
         * Resets the styles and thumb delta.
         */
        reset() {
            if (this.isDraggingScroll) {
                this.scrollbarThumb.classList.remove('coh-scrollbar-thumb--active');
                this.isDraggingScroll = false;
            }

            this.thumbDelta.x = 0;
            this.thumbDelta.y = 0;
        }

        /**
         * Restricts a given value to a given range.
         *
         * @param {number} value
         * @param {number} min
         * @param {number} max
         * @return {number}
         */
        clamp(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        setScrollBoundaries() {
            this.padding = this.getPaddingInPixels();
            this.thumbRect = /** @type {DOMRect} */ (this.scrollbarThumb.getBoundingClientRect());
            this.thumbSize = this.getActiveDimension(this.thumbRect);

            this.maxScroll = (this.scrollableContentSize - this.thumbSize) / this.scrollableContentSize;

            if (isNaN(this.maxScroll) || this.maxScroll < 0) {
                this.maxScroll = 0;
            }

            // It is two times the padding, because it takes the assumption of a uniform padding.
            const twoTimesPadding = 2 * this.padding;
            const scrollTrackAreaSize = this.scrollableAreaSize - twoTimesPadding;
            this.maxThumbPosition = (scrollTrackAreaSize - this.thumbSize) / scrollTrackAreaSize;

            if (isNaN(this.maxThumbPosition) || this.maxThumbPosition < 0) {
                this.maxThumbPosition = 0;
            }
        }

        /**
         * Resizes the scrollbar thumb
         * @param {number} percentage - between 0 and 1 - percentage for scroll thumb
         * @param {boolean} [shouldSetScrollPositionFromLayout = false]
         */
        resizeScrollThumb(percentage = 0, shouldSetScrollPositionFromLayout = false) {
            this.scrollAreaRect = /** @type {DOMRect} */ (this.scrollArea.getBoundingClientRect());
            this.scrollableAreaSize = this.getActiveDimension(this.scrollAreaRect);

            if (this.scrollArea.firstElementChild) {
                this.scrollableContentRect = /** @type {DOMRect} */ (this.scrollArea.firstElementChild.getBoundingClientRect());
                this.scrollableContentSize = this.getActiveDimension(this.scrollableContentRect);
            } else {
                this.scrollableContentSize = this.getActiveDimension({
                    width: this.scrollArea.scrollWidth,
                    height: this.scrollArea.scrollHeight
                });
            }


            let sizePercentage;

            if (!percentage) {
                const maxScrollPX = this.maxScrollOnScrollAreaInPixels;
                const calculatedSizePercentage = 1 - (maxScrollPX - this.scrollableAreaSize) / maxScrollPX;
                sizePercentage = calculatedSizePercentage < minSizePercentage ? minSizePercentage : calculatedSizePercentage;
            } else {
                sizePercentage = percentage < minSizePercentage ? minSizePercentage : percentage;
            }

            if (sizePercentage > 0.97 || isNaN(sizePercentage)) {
                this.hide();
            } else {
                this.show();

                this.scrollbarThumb.style[this.activeCssSizeProp] = sizePercentage * 100 + '%';
            }

            // We need to set the scroll data on
            // the next frame, because we need to know
            // how big will the scrollbar thumb be.
            Delay.byFrame(this.boundSetScrollData, 3, shouldSetScrollPositionFromLayout);
        }
    }

    Scrollbar.SELECTED_ITEM_CLASS = 'scroll-item--selected';
    Scrollbar.SELECTED_ITEM_SELECTOR = '.' + Scrollbar.SELECTED_ITEM_CLASS;

    class ScrollbarManager {
        static getInstance() {
            if (!this._instance) {
                this._instance = new ScrollbarManager();
            }

            return this._instance;
        }
        /**
     * @param {string} selector
     * @param {any} componentConstructor
     */
        constructor() {
            this.componentConstructor = Scrollbar;
            /**
             * @type {Map<ComponentBase, ComponentBase>}
             */
            this.components = new Map();
            this.activeComponent = null;
        }

        showError(errorMessage) {
            console.error(errorMessage);
        }

        /**
         *
         * @param {object} options - configuration
         * @param {boolean} isNested - whether it's the main configuration for a custom config for a specific element
         * @returns {string} - the error string, an empty string if everything is valid
         */
        validateOptions(options, isNested = false) {
            const allowedArray = !isNested;

            if (typeof options !== 'object') {
                return ERRORS.get('type_object')();
            }

            const selector = options[MANDATORY_OPTIONS_KEY];

            if (!selector) {
                return ERRORS.get('missing_mandatory_key')(MANDATORY_OPTIONS_KEY);
            }

            if (!allowedArray && Helpers.isArray(selector)) {
                return ERRORS.get('type_array')(MANDATORY_OPTIONS_KEY);
            }

            if (!Helpers.isOfAllowedTypes(selector)) {
                return ERRORS.get('type_string_or_Element')(selector);
            }

            if (typeof value === 'object' && !Helpers.isHTMLElement(value)) {
                const error = this.validateOptions(value, true);
                if (error) return (error);
            }

            if (allowedArray && Helpers.isArray(selector)) {
                for (let value of selector) {
                    if (!Helpers.isOfAllowedTypes(value)) {
                        return ERRORS.get('type_string_or_Element')(value);
                    }
                    if (typeof value === 'object' && !Helpers.isHTMLElement(value)) { // we've already checked if its an arrray no need to check again
                        const error = this.validateOptions(value, true);
                        if (error) return (error);
                    }
                }
            }

            return '';
        }

        create(options = { registerAll: false, isVertical: true }) {
            const errorMessage = this.validateOptions(options);

            if (errorMessage) {
                this.showError(errorMessage);
                return;
            }

            let componentElement;
            const wrapperElementOrSelector = options.selector;
            this.contentSelector = options.contentSelector || '.content';

            const scrollbarOptions = {
                isVertical: options.isVertical,
                contentSelector: this.contentSelector,
                thumbClassName: options.thumbClassName,
                trackClassName: options.trackClassName
            };

            // HTMLElement || string (css selector)
            if (typeof wrapperElementOrSelector === 'string' || Helpers.isHTMLElement(wrapperElementOrSelector)) {
                componentElement = this.getComponentElement(wrapperElementOrSelector, options.registerAll);
                return componentElement ? this.initComponents(componentElement, scrollbarOptions) : null;
            }

            // object
            if (typeof wrapperElementOrSelector === 'object'
                && !Helpers.isArray(wrapperElementOrSelector)
                && !Helpers.isHTMLElement(wrapperElementOrSelector)) {
                this.contentSelector = wrapperElementOrSelector.contentSelector || this.contentSelector;
                componentElement = this.getComponentElement(wrapperElementOrSelector.selector, options.registerAll);
                return componentElement ? this.initComponents(componentElement, scrollbarOptions) : null;
            }

            // array
            for (let elementOrSelector of wrapperElementOrSelector) {
                const isHTMLElement = Helpers.isHTMLElement(elementOrSelector);

                if (typeof elementOrSelector === 'object' && !isHTMLElement) {
                    this.create(elementOrSelector);
                    continue;
                }

                componentElement = this.getComponentElement(elementOrSelector, options.registerAll);

                if (!componentElement) return;

                this.initComponents(componentElement, scrollbarOptions);
            }
        }

        getComponentElement(elementOrSelector, initAll) {
            const componentElement = Helpers.isHTMLElement(elementOrSelector) ? [elementOrSelector] : initAll ?
                document.querySelectorAll(elementOrSelector) : [document.querySelector(elementOrSelector)];

            return componentElement[0] !== null ? componentElement :
                console.error(`There is no element with selector ${elementOrSelector}!`);
        }


        /**
         * Adds a given component to the list of monitored components.
         *
         * @param {HTMLElement} component
         * @returns {ComponentBase}
         */
        registerComponent(component, options) {
            // @ts-ignore
            if (component.__CLComponent__) {
                console.warn(`Component with id: ${component.id} and classList: ${component.classList.value} has already been registerd.
                Plase, make sure that you really want to register this component
                again. Registering a component multiple times might lead to
                unexpected behaviour, such as multiple calls of event handlers!`);
            }

            const instance = new this.componentConstructor(component, this, options);
            this.components.set(instance, instance);

            return instance;
        }

        /**
         * Removes a given component from monitoring by a given instance
         *
         * @param {ComponentBase} instance
         */
        deregisterComponent(instance) {
            instance.removeMutationObserver()
            instance.onDestroy();
            this.components.delete(instance);
        }

        /**
         * Initializes all components.
         */
        initComponents(componentElements, options) {
            const componentLength = componentElements.length;

            for (let i = 0; i < componentLength; ++i) {
                this.registerComponent(/**@type {HTMLElement} */(componentElements[i]), options);
            }

            this.initBoundEvents();
            this.attachEventListeners();
        }


        /**
         * Calls the onUpdate handler on all components.
         */
        updateAllComponents() {
            this.components.forEach((component) => {
                component.onUpdate();
            });
        }

        /**
         * Removes all components from the monitoring.
         */
        destroyAllComponents() {
            this.removeEventListeners();

            this.components.forEach((component) => {
                component.onDestroy();
            });

            this.components.clear();
        }

        initBoundEvents() {
            this.boundScrollFromGamepad = () => {
                this.scrollFromGamepad();
            };

            this.boundOnKeyDownDelayed = (event) => {
                Delay.byFrame(this.boundOnKeyDown, 1, event);
            };

            this.boundOnKeyDown = (event) => {
                this.onKeyDown(event);
            };

            this.boundOnMouseDown = (event) => {
                this.onMouseDown(event);
            };

            this.boundOnMouseUp = () => {
                this.onMouseUp();
            };

            this.boundOnMouseMove = (event) => {
                this.onMouseMove(event);
            };

            this.boundOnResize = () => {
                Delay.byFrame(this.boundResizeAllComponents, 3);
            };

            this.boundResizeAllComponents = () => {
                for (let [key, component] of this.components) {
                    /** @type {Scrollbar} */(component).resizeScrollThumb();
                }
            }
        }

        /**
         * Attaches all event listeners needed for the scrollbars
         */
        attachEventListeners() {
            window.addEventListener('gamepadconnected', this.boundScrollFromGamepad);
            document.addEventListener('keydown', this.boundOnKeyDownDelayed);
            document.addEventListener('mousedown', this.boundOnMouseDown);
            window.addEventListener('mouseup', this.boundOnMouseUp);
            window.addEventListener('mousemove', this.boundOnMouseMove);
            window.addEventListener('resize', this.boundOnResize);
        }

        onKeyDown(event) {
            if (this.activeComponent) {
                this.activeComponent.onKeydown(event);
            }
        }

        onMouseDown(event) {
            this.setActiveComponent(event);
        }

        onMouseUp() {
            this.resetActiveScroll();
        }

        onMouseMove(event) {
            if (this.activeComponent) {
                this.activeComponent.onMouseMove(event);
            }
        }

        removeEventListeners() {
            window.removeEventListener('gamepadconnected', this.boundScrollFromGamepad);
            document.removeEventListener('keydown', this.boundOnKeyDownDelayed);
            document.removeEventListener('mousedown', this.boundOnMouseDown);
            window.removeEventListener('mouseup', this.boundOnMouseUp);
            window.removeEventListener('mousemove', this.boundOnMouseMove);
            window.removeEventListener('resize', this.boundOnResize);
        }

        /**
         * Sets the active scroll bar on every click
         * @param {Event} event
         * @return {boolean}
         */
        setActiveComponent(event) {
            let element = /**@type {HTMLElement}*/(event.target);
            if (!element.classList || this.activeComponent && this.activeComponent.isDraggingScroll) {
                return false;
            }

            let isInScrollArea = false;

            while (element) {
                if (element.classList && element.classList.contains('scrollable-container')) {
                    // @ts-ignore
                    this.activeComponent = element.__CLComponent__;
                    isInScrollArea = true;
                    break;
                }

                element = element.parentElement;
            }

            if (!isInScrollArea) {
                this.activeComponent = null;
            }
        }

        /**
         * Resets the styles of the active scroll
         * @return {boolean}
         */
        resetActiveScroll() {
            const activeScrollbar = this.activeComponent;

            if (!activeScrollbar) {
                return false;
            }

            activeScrollbar.reset();
        }
    }

    if (!global.Scrollbar) global.Scrollbar = ScrollbarManager.getInstance();
});