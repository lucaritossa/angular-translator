import {provide, NoProviderError, Key, Injector} from "angular2/core";
import {HTTP_PROVIDERS, XHRBackend} from "angular2/http";
import {MockBackend} from "angular2/src/http/backends/mock_backend";
import {PromiseMatcher, JasminePromise} from "./helper/promise-matcher";
import {TranslateService} from '../angular2-translator/TranslateService';
import {TranslateConfig} from "../angular2-translator/TranslateConfig";
import {TranslateLoader} from "../angular2-translator/TranslateLoader";
import {TRANSLATE_PROVIDERS} from "../angular2-translator";
import {first} from "rxjs/operator/first";

export function main() {
    function calls(spy:any):jasmine.Calls {
        return spy.calls;
    }

    describe('TranslateService', function () {
        it('is defined', function () {
            expect(TranslateService).toBeDefined();
        });

        describe('constructor', function () {
            it('requires a TranslateConfig', function () {
                var injector = Injector.resolveAndCreate([
                    HTTP_PROVIDERS,
                    TranslateService
                ]);

                var action = function () {
                    injector.get(TranslateService);
                };

                var providerError = new NoProviderError(injector, Key.get(TranslateConfig));
                providerError.addKey(injector, Key.get(TranslateService));
                expect(action).toThrow(providerError);
            });

            it('requires a TranslateLoader', function () {
                var injector = Injector.resolveAndCreate([
                    HTTP_PROVIDERS,
                    TranslateService,
                    provide(TranslateConfig, {useValue: new TranslateConfig({})})
                ]);

                var action = function () {
                    injector.get(TranslateService);
                };

                var providerError = new NoProviderError(injector, Key.get(TranslateLoader));
                providerError.addKey(injector, Key.get(TranslateService));
                expect(action).toThrow(providerError);
            });

            it('predfines providers for default config', function () {
                var injector = Injector.resolveAndCreate([
                    HTTP_PROVIDERS,
                    TRANSLATE_PROVIDERS
                ]);
                var translate:TranslateService;

                var action = function () {
                    translate = injector.get(TranslateService);
                };

                expect(action).not.toThrow();
                expect(translate instanceof TranslateService).toBeTruthy();
            });

            it('sets current lang to default lang', function () {
                var injector = Injector.resolveAndCreate([
                    HTTP_PROVIDERS,
                    TRANSLATE_PROVIDERS
                ]);

                var translate:TranslateService = injector.get(TranslateService);

                expect(translate.currentLang()).toBe('en');
            });
        });

        describe('instance', function () {
            var translateConfig:TranslateConfig = new TranslateConfig({});
            var translate:TranslateService;
            var loader:TranslateLoader;

            beforeEach(function () {
                translateConfig.providedLangs = ['en'];
                translateConfig.defaultLang = 'en';
                var injector:Injector = Injector.resolveAndCreate([
                    HTTP_PROVIDERS,
                    TRANSLATE_PROVIDERS,
                    provide(TranslateConfig, {useValue: translateConfig})
                ]);
                translate             = injector.get(TranslateService);
                loader                = injector.get(TranslateLoader);
                PromiseMatcher.install();
            });

            afterEach(function() {
                //jasmine.clock().uninstall();
                PromiseMatcher.uninstall();
            });

            describe('detect language', function () {
                var mockNavigator:any;

                beforeEach(function () {
                    mockNavigator = {};
                });

                it('detects language by navigator.language', function () {
                    translateConfig.providedLangs = ['bm', 'en'];
                    mockNavigator.language        = 'bm';

                    var detectedLang = translate.detectLang(mockNavigator);

                    expect(detectedLang).toBe('bm');
                });

                it('detects only languages that are provided', function () {
                    translateConfig.providedLangs = ['en'];
                    mockNavigator.language        = 'bm';

                    var detectedLang = translate.detectLang(mockNavigator);

                    expect(detectedLang).toBeFalsy();
                });

                it('using config.langProvided for checking', function () {
                    mockNavigator.language = 'bm';
                    spyOn(translateConfig, 'langProvided');

                    var detectedLang = translate.detectLang(mockNavigator);

                    expect(translateConfig.langProvided).toHaveBeenCalledWith('bm');
                });

                it('rather checks navigator.languages', function () {
                    translateConfig.providedLangs = ['de-DE', 'de-AT'];
                    mockNavigator.language        = 'de-CH';
                    mockNavigator.languages       = ['de-CH', 'de-AT'];

                    var detectedLang = translate.detectLang(mockNavigator);

                    expect(detectedLang).toBe('de-AT');
                });
            });

            describe('use language', function () {
                it('checks that language is provided using strict checking', function () {
                    spyOn(translateConfig, 'langProvided');

                    translate.useLang('en');

                    expect(translateConfig.langProvided).toHaveBeenCalledWith('en', true);
                });

                it('sets current language to the provided language', function () {
                    translateConfig.providedLangs = ['de/de'];

                    translate.useLang('de-DE');

                    expect(translate.currentLang()).toBe('de/de');
                });

                it('returns false if language is not provided', function () {
                    translateConfig.providedLangs = ['de/de'];

                    var result = translate.useLang('de');

                    expect(result).toBeFalsy();
                });
            });

            describe('waiting for translation', function () {
                var loaderPromiseResolve:Function;
                var loaderPromiseReject:Function;

                beforeEach(function() {
                    spyOn(loader, 'load').and.returnValue(new Promise<Object>((resolve, reject) => {
                        loaderPromiseResolve = resolve;
                        loaderPromiseReject = reject;
                    }));
                });

                it('returns a promise', function () {
                    var promise = translate.waitForTranslation();

                    expect(promise instanceof Promise).toBeTruthy();
                });

                it('starts loading the current language', function () {
                    translate.waitForTranslation();

                    expect(loader.load).toHaveBeenCalledWith('en');
                });

                it('resolves when loader resolves', function() {
                    var promise = translate.waitForTranslation();

                    loaderPromiseResolve({"TEXT":"This is a text"});

                    expect(promise).toBeResolved();
                });

                it('rejects when loader rejects', function() {
                   var promise = translate.waitForTranslation();

                    loaderPromiseReject();

                    expect(promise).toBeRejected();
                });

                it('loads a language only once', function() {
                    translate.waitForTranslation();
                    translate.waitForTranslation();

                    expect(calls(loader.load).count()).toBe(1);
                });

                it('returns the already resolved promise', function() {
                    var firstPromise = translate.waitForTranslation();
                    loaderPromiseResolve({"TEXT":"This is a text"});

                    var secondPromise = translate.waitForTranslation();

                    expect(secondPromise).toBeResolved();
                    expect(secondPromise).toBe(firstPromise);
                });

                it('loads given language', function() {
                    translateConfig.providedLangs = ['en', 'de'];

                    translate.waitForTranslation('de');

                    expect(loader.load).toHaveBeenCalledWith('de');
                });

                it('checks if the language is provided', function() {
                    spyOn(translateConfig, 'langProvided');

                    translate.waitForTranslation('de');

                    expect(translateConfig.langProvided).toHaveBeenCalledWith('de', true);
                });

                it('rejects if the language is not provided', function() {
                    var promise = translate.waitForTranslation('de');

                    expect(promise).toBeRejectedWith('Language not provided');
                });
            });

            describe('translate', function() {
                var loaderPromiseResolve:Function;
                var loaderPromiseReject:Function;

                beforeEach(function() {
                    spyOn(loader, 'load').and.returnValue(new Promise<Object>((resolve, reject) => {
                        loaderPromiseResolve = resolve;
                        loaderPromiseReject = reject;
                    }));
                });

                it('loads the current language', function() {
                    translate.translate('TEXT');

                    expect(loader.load).toHaveBeenCalledWith('en');
                });

                it('loads the given language', function() {
                    translateConfig.providedLangs = ['en', 'de'];

                    translate.translate('TEXT', {}, 'de');

                    expect(loader.load).toHaveBeenCalledWith('de');
                });

                it('checks if the language is provided', function() {
                    spyOn(translateConfig, 'langProvided');

                    translate.translate('TEXT', {}, 'de');

                    expect(translateConfig.langProvided).toHaveBeenCalledWith('de', true);
                });

                // current language got checked before
                it('does not check current language', function() {
                    spyOn(translateConfig, 'langProvided');

                    translate.translate('TEXT');

                    expect(translateConfig.langProvided).not.toHaveBeenCalled();
                });

                it('loads a language only once', function() {
                    translate.translate('TEXT');
                    translate.translate('OTHER_TEXT');

                    expect(calls(loader.load).count()).toBe(1);
                });

                it('resolves keys if language is not provided', function() {
                    var promise = translate.translate('TEXT', {}, 'de');

                    expect(promise).toBeResolvedWith('TEXT');
                });

                it('resolves keys if laguage could not be loaded', function() {
                    var promise = translate.translate(['TEXT', 'OTHER_TEXT']);

                    loaderPromiseReject();

                    expect(promise).toBeResolvedWith(['TEXT', 'OTHER_TEXT']);
                });

                it('uses instant to translate after loader resolves', function() {
                    spyOn(translate, 'instant');
                    translate.translate('TEXT');

                    loaderPromiseResolve({'TEXT': 'This is a text'});
                    JasminePromise.flush();

                    expect(translate.instant).toHaveBeenCalledWith('TEXT', {}, translate.currentLang());
                });

                it('resolves with the return value from instant', function() {
                    spyOn(translate, 'instant').and.returnValue('This is a text');
                    var promise = translate.translate('TEXT');

                    loaderPromiseResolve({'TEXT': 'This is a text'});

                    expect(promise).toBeResolvedWith('This is a text');
                });
            });

            describe('instant', function() {

                beforeEach(function() {
                    var loaderPromiseResolve:Function = (t:Object) => {};
                    spyOn(loader, 'load').and.returnValue(new Promise<Object>((resolve, reject) => {
                        loaderPromiseResolve = resolve;
                    }));

                    translate.waitForTranslation();
                    loaderPromiseResolve({
                        TEXT: 'This is a text',
                        INTERPOLATION: 'The sum from 1+2 is {{1+2}}',
                        VARIABLES_TEST: 'This {{count > 5 ? "is interesting" : "is boring"}}',
                        VARIABLES_OUT: 'Hello {{name.first}} {{name.title ? name.title + " " : ""}}{{name.last}}',
                        BROKEN: 'This "{{notExisting.func()}}" is empty string',
                        SALUTATION: '{{name.title ? name.title + " " : (name.gender === "w" ? "Ms." : "Mr.")}}{{name.first}} {{name.last}}',
                        WELCOME: 'Welcome{{lastLogin ? " back" : ""}} [[SALUTATION:name]]!{{lastLogin ? " Your last login was on " + lastLogin : ""}}',
                        HACK: '{{privateVar}}{{givenVar}}',
                        CALL: 'You don\'t know {{privateVar}} but [[HACK:givenVar]]'
                    });

                    JasminePromise.flush();
                });

                it('returns keys if language is not loaded', function() {
                    var translation = translate.instant('TEXT', {}, 'de');

                    expect(translation).toBe('TEXT');
                });

                it('returns keys if translation not found', function() {
                    var translations = translate.instant(['SOME_TEXT', 'OTHER_TEXT']);

                    expect(translations).toEqual(['SOME_TEXT', 'OTHER_TEXT']);
                });

                it('returns interpolated text', function() {
                    var translations = translate.instant([
                        'INTERPOLATION',
                        'VARIABLES_TEST',
                        'VARIABLES_OUT'
                    ], {
                        count: 6,
                        name: {
                            first: 'John',
                            last: 'Doe'
                        }
                    });

                    expect(translations).toEqual([
                        'The sum from 1+2 is 3',
                        'This is interesting',
                        'Hello John Doe'
                    ]);
                });

                it('catches parse errors in translations', function() {
                    var translation = translate.instant('BROKEN');

                    expect(translation).toBe('This "" is empty string');
                });

                it('translates values in brackets', function() {
                    var translation = translate.instant('WELCOME', {
                        lastLogin: '24th of February, 2016',
                        name: {
                            gender: 'w',
                            first: 'Jane',
                            title: 'Dr.',
                            last: 'Doe'
                        }
                    });

                    expect(translation).toBe('Welcome back Dr. Jane Doe! Your last login was on 24th of February, 2016');
                });

                it('transports only variables defined to subtranslations', function() {
                    var translation = translate.instant('CALL', {
                        privateVar: 'private',
                        givenVar: 'given'
                    });

                    expect(translation).toBe('You don\'t know private but given');
                });
            });
        });
    });
}
