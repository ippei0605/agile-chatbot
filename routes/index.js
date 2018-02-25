/**
 * Q&A Chatbot: ルーティング
 *
 * | url             | パラメータ                                      |処理            　    |
 * | :-------------  | : -------------------------------------------  |:------------------  |
 * | /               |                                                | Q&A 画面を表示する。  |
 * | /ask            | text テキスト, now 時刻 (yyyy年M月d日 h時m分s秒)  | Watson に尋ねる。    |
 * | /class-name     | text テキスト, now 時刻 (yyyy年M月d日 h時m分s秒)  | クラス名を問合せる。  |
 *
 * @module routes/index
 * @author Ippei SUZUKI
 */

'use strict';

// モジュールを読込む。
const
    express = require('express'),
    moment = require('moment'),
    QaModel = require('watson-nlc-qa'),
    context = require('../utils/context'),
    fbLog = require('../models/feedback-log');

// ルーターを作成する。
const router = express.Router();

// Q&A モデルを作成する。
const qa = new QaModel(context.cloudantCreds, context.DB_NAME, context.nlcCreds);

// こんにちはを変換する。
const replaceHello = (text, replaceText) => {
    return text.replace(/こんにちは/g, replaceText);
};

// 条件により回答を確定する。
const editAnswer = (value, now) => {
    // 時間帯による挨拶文
    switch (value.class_name) {
        case 'general_hello':
            let regexp = /(\d+)年(\d+)月(\d+)日 (\d+)時(\d+)分(\d+)秒/;
            let hour = parseInt(regexp.exec(now)[4], 10);
            if (hour >= 17) {
                value.message = replaceHello(value.message, 'こんばんは');
            } else if (hour < 11 && hour >= 5) {
                value.message = replaceHello(value.message, 'おはようございます');
            } else if (hour < 5) {
                value.message = replaceHello(value.message, 'お疲れ様です');
            }
            break;

        default:
            break;
    }
    return value;
};

// Q&A 画面を表示する。
router.get('/', (req, res) => {
    qa.getAppSettings((value) => {
        res.render('index', {title: value.name});
    });
});

// 高評価する。
router.post('/feedback/:id/like', (req, res) => {
    fbLog.get(req.params.id)
        .then((value) => {
            value.like = true;
            return fbLog.insert(value);
        })
        .then((value) => {
            res.sendStatus(200);
        })
        .catch((error) => {
            res.sendStatus(500);
            console.log('error:', error);
        });
});

// 悪い評価をする。
router.post('/feedback/:id/dislike', (req, res) => {
    fbLog.get(req.params.id)
        .then((value) => {
            value.like = false;
            value.comment = req.body.comment;
            return fbLog.insert(value);
        })
        .then((value) => {
            res.sendStatus(200);
        })
        .catch((error) => {
            res.sendStatus(500);
            console.log('error:', error);
        });

});

// Watson に尋ねる。
router.get('/ask', (req, res) => {
    const text = req.query.text;

    qa.ask(text, (value) => {
        // 一次メッセージを保管する。
        const temp = value.message;

        qa.askClassName('general_sorry', (sorry) => {

            // 最終回答を取得する。
            let finalAnswer;
            if (value.confidence < 0.3) {
                finalAnswer = sorry;
            } else {
                finalAnswer = editAnswer(value, req.query.now);
            }
            finalAnswer.temp = temp;

            fbLog.insert({
                datetime: moment.utc().format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'),
                question: text,
                class_name: finalAnswer.class_name,
                answer: finalAnswer.temp,
                final_answer: finalAnswer.message,
                confidence: finalAnswer.confidence,
            })
                .then((value) => {
                    finalAnswer.feedback_id = value.id;
                    finalAnswer.feedback_rev = value.rev;
                    res.send(finalAnswer);
                })
                .catch((error) => {
                    console.log('error:', error);
                    res.send(finalAnswer);
                });
        });
    });
});

// クラス名を問合せる。
router.get('/class-name', (req, res) => {
    qa.askClassName(req.query.text, (value) => {
        res.send(editAnswer(value, req.query.now));
    });
});

module.exports = router;
