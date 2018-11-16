
var deps;
gasOrder.menu(
    'PRODUCTION',
    // 'DEVELOPMENT',
    [
        // 'assistant/gasLog',
        'assistant/juruo',
        'assistant/Gasdb',
        'assistant/timeStamping',
        'assistant/GasWebRecorder',
        '_config',
        'juruo_zh_TW',
        'dataCrawler',
    ],
    function (_deps) {
        deps = _deps;
        deps.webRecorder = new deps.GasWebRecorder('webRecorder');
    }
);

function dataCrawler() {
    deps.webRecorder.trigger('dataCrawler', function () {
        deps.dataCrawler.run();
    })();
}

