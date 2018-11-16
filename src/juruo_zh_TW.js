
gasOrder('juruo_zh_TW', function (deps) {
    deps.juruo.set({
        __undefined: 'Unexpected log message.',
        __illegalInvocation: 'Illegal invocation.',
        __inconsistentExpectation:
            'The usage of "{name}" is inconsistent with expectation.',
        __notExpected:
            '"{name}" 不符合預期。',
        __typeError:
            '不符合預期類型。',
        __restrictedType:
            '"{name}" 必須為 `{type}`. 收到 `{actual}` 類型。',
        __restrictedNotType:
            '"{name}" 必須不為 `{type}`. 收到 `{actual}` 類型。',

        // assistant
        _assistant_notExistSpreadsheetConfig:
            '試算表配置未設定。',
        _assistant_notExistSheet:
            '"{spreadsheet}" 試算表不存在。',
        _assistant_notExistSheetTable:
            '"{spreadsheet}" 試算表的 "{table}" 表格不存在。',
        _assistant_notEqualLengthColumnOfSheetTable:
            '表格中每行的欄位數量必須相等。',
        _assistant_tableSameKeys:
            '不能有相同的鍵值。',

        // dataCrawler
        _dataCrawler_notMatchingUpAtNeedItem:
            '不符需求的執行項目數量。',
        _dataCrawler_needItemBaffled:
            '不存在的需求項目。 ({queryKey})',
    });
});

