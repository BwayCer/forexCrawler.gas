
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
        'assistant/tgbot',
        '_config',
        'juruo_zh_TW',
        'kidCount',
    ],
    function (_deps) {
        deps = _deps;
        deps.webRecorder = new deps.GasWebRecorder('webRecorder');
    }
);

function kidCount() {
    deps.webRecorder.trigger('kidCount', function () {
        deps.kidCount.run();
    })();
}

