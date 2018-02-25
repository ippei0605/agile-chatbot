/**
 * @file Q&A Chatbot: インストール後処理 (package.json の scripts.postinstall で実行するように設定)
 *
 * <pre>
 * 1. データベース「answer」が無い場合、次の処理を実行する。
 *   1-1 データベースを作成する。
 *   1-2 設計文書を登録する。
 *   1-3 データを登録する。
 * 2. NLC の Classifier が無い場合、Classifier を作成する。
 * 3. 次の処理を実行する。
 *   1-1 データベース「Feedback_log」を作成する。
 *   1-2 設計文書を登録する。
 * (1、2 および 3 は並列処理)
 * </pre>
 *
 * @author Ippei SUZUKI
 */

'use strict';

// モジュールを読込む。
const
    fs = require('fs'),
    QaModel = require('watson-nlc-qa'),
    fbLog = require('../models/feedback-log'),
    context = require('../utils/context');

// コンテンツファイル
const CONTENT_FILENAME = 'answer.json';

// トレーニングデータ
const
    TRAINING_FILE = fs.createReadStream(__dirname + '/classifier.csv'),
    METADATA = {
        "language": "ja",
        "name": "My Classifier"
    };

// Q&A モデルを作成する。
const qa = new QaModel(context.cloudantCreds, context.DB_NAME, context.nlcCreds);

// 処理1
qa.createDatabase(() => {
    // 設計文書を作成する。
    qa.insertDesignDocument();

    // データを登録する。
    const data = fs.readFileSync(__dirname + '/' + CONTENT_FILENAME).toString();
    qa.insertDocuments(JSON.parse(data));
});

// 処理2
qa.train(TRAINING_FILE, METADATA);


// 処理3
fbLog.createDatabase()
    .then((value) => {
        console.log(value);
        return fbLog.createDesignDocument(fbLog.designDocument);
    })
    .then((value) => {
        console.log(value);
    })
    .catch((error) => {
        console.log(error);
    });
