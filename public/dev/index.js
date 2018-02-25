/**
 * @file Q&A Chatbot: クライアント JavaScript
 *
 * <pre>
 * 起動方法:
 * ・view/index.ejs から呼び出す。
 *
 * 起動条件:
 * ・jQuery および watson-speech が読込まれていること。
 *
 * 処理記述:
 * ・Q&A Chatbot を制御する。
 * </pre>
 *
 * @author Ippei SUZUKI
 */

'use strict';

// jQuery を使用する。(DOM 読込み完了時の処理)
$(function () {
    $('[data-toggle="tooltip"]').tooltip();

    // タグ
    const
        questionTag = '<div class="row"><div class="col-xs-12"><p class="balloon-right success"><%= s %></p></div></div>',
        answerTag = '<div class="row"><div class="col-xs-3 col-md-1" style="padding: 10px 5px"><figure class="chat-img-left"><img class="img-responsive" src="<%= s %>"><figcaption class="chat-img-description"><small>ぶるみ</small></figcaption></figure></div><div class="col-xs-9 col-md-11" style="padding: 10px 5px"><p class="balloon-left"><%= s %><%= s %><%= s %></p></div></div>',
        feedbackTag = '<span id="<%= s %>"><br><br>お役に立てましたか？ <button class="btn btn-xs btn-success btn-feedback" data-like=true data-id="<%= s %>"> <i class="fa fa-thumbs-up" aria-hidden="true"></i></button> <button class="btn btn-xs btn-danger btn-feedback" data-like=false data-id="<%= s %>"><i class="fa fa-thumbs-down" aria-hidden="true"></i></button></span>';

    /// 定型メッセージ
    const messages = {
        "error_ajax": "通信エラーです。申し訳ございませんが最初からやり直してください。",
        "error_watson_auth": "Watson Speech の認証に失敗しました。音声認識と音声合成 (テキスト読上げ) は使用できません。",
    };

    // マイク入力のためのオブジェクトを設定する。チェックのみに使用。(非対応ブラウザを考慮)
    const getUserMedia = navigator.getUserMedia
        || navigator.webkitGetUserMedia
        || navigator.mozGetUserMedia
        || navigator.msGetUserMedia
        || null;

    // ID セレクターを取得する。
    const
        conversationFieldId = $('#conversationFieldId'),
        qId = $('#qId'),
        microphoneIconId = $('#microphoneIconId'),
        sttId = $('#sttId'),
        searchFormId = $('#searchFormId');

    // Watson Speech API コンテキスト
    let watsonSpeechContext = null;

    // 音声認識中フラグ
    let recording = false;

    // マイクのストリーム
    let stream = null;

    // フィードバック対象の文書 ID (ID がセットされている場合はフィードバック中)
    let feedbackId;

    // キャラクターイメージの URL を返す。
    function getCharacter () {
        return '/bluemiku_?.png'.replace(/[?]/, function () {
            return Math.floor((Math.random() * 2) + 1).toString();
        });
    }

    // 現在時刻を返す。
    function getNow () {
        const now = new Date();
        return now.getFullYear() + '年'
            + (now.getMonth() + 1) + '月'
            + now.getDate() + '日 '
            + now.getHours() + '時'
            + now.getMinutes() + '分'
            + now.getSeconds() + '秒';
    }

    // テンプレートタグにパラメータを付与する。
    function formatTag (tag, s) {
        const array = tag.split('<%= s %>');
        let j = 0, result = array[0];
        for (let i = 1, length = array.length; i < length; i++) {
            result += s[j++] + array[i];
        }
        return result;
    }

    // 確度を編集する。
    function formatConfidence (confidence) {
        let value = '';
        // 0 の時は表示しない。 (定型メッセージ)
        if (confidence !== 0) {
            value = '[' + parseInt(Math.abs(confidence) * 100) + '%]';
        }
        return value;
    }

    // 定型メッセージ用の JSON を返す。
    function getMessageJson (key) {
        return {
            "message": messages[key],
            "confidence": 0
        };
    }

    // テキストを読み上げる。
    function textToSpeech (text) {
        if (watsonSpeechContext) {
            const param = {
                "text": text.split('。')[0].replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, ''),
                "token": watsonSpeechContext.tts.token,
                "voice": watsonSpeechContext.tts.voice
            };
            if (watsonSpeechContext.tts.customization_id) {
                param.customization_id = watsonSpeechContext.tts.customization_id;
            }
            WatsonSpeech.TextToSpeech.synthesize(param);
        }
    }

    // リンクされた文で質問する。
    $(document).on('click', 'a.linkedAsk', function () {
        qId.val($(this).attr('href'));
        searchFormId.submit();
        return false;
    });

    // 好評価する。
    function like (id) {
        $.ajax({
            "type": "POST",
            "url": '/feedback/' + id + '/like',
        }).done(function (value) {
            console.log('like:', value);
        }).fail(function (error) {
            console.log('error:', error);
        }).always(function () {
            ask('class-name', 'general_feedback_like', true);
            $('#' + id).remove();
        });
    }

    // 悪い評価をする。
    function dislike (comment) {
        $.ajax({
            "type": "POST",
            "url": '/feedback/' + feedbackId + '/dislike',
            "data": {
                "comment": comment
            }
        }).done(function (value) {
            console.log('dislike:', value);
        }).fail(function (error) {
            console.log('error:', error);
        }).always(function () {
            feedbackId = undefined;
            ask('class-name', 'general_feedback_end', true);
        });
    }

    // フィードバックする。
    $(document).on('click', 'button.btn-feedback', function () {
        const id = $(this).data('id');
        if ($(this).data('like')) {
            like(id);
        } else {
            feedbackId = id;
            ask('class-name', 'general_feedback_dislike', true);
            $('#' + id).remove();
        }
    });

    // 回答を表示する。
    function viewAnswer (value) {
        const message = value.message;

        // 回答を読み上げる。
        textToSpeech(message);

        // フィードバックを作成する。
        const feedback = value.class_name.indexOf('general_') === -1 ? formatTag(feedbackTag, [value.feedback_id, value.feedback_id, value.feedback_id]) : '';

        // メッセージの改行を<br>に置換して表示用メッセージを作成する。
        const dispAnswer = message.replace(/\n/g, '<br>');


        // 回答を表示する。
        conversationFieldId.append(formatTag(answerTag, [getCharacter(), dispAnswer, formatConfidence(value.confidence), feedback]));

        // 最下部までスクロールする。
        window.scrollTo(0, document.body.scrollHeight);
    }

    // Watson Gif アニメ を制御する。 [isStart = true: 実行, false: 削除]
    function anime (isStart) {
        const loadingViewId = $('#loading-view');
        if (isStart) {
            if (!loadingViewId.length) {
                $('body').append('<div id="loading-view" />');
            }
        } else {
            if (loadingViewId.length) {
                loadingViewId.remove();
            }
        }
    }

    // Waston に質問する。
    function ask (url, text, disableAnimeFlg) {
        //  アニメーション ON
        if (!disableAnimeFlg) {
            anime(true);
        }

        $.ajax({
            "type": "GET",
            "url": url,
            "data": {
                "text": text,
                "now": getNow()
            }
        }).done(function (value) {
            viewAnswer(value);
        }).fail(function () {
            viewAnswer(getMessageJson('error_ajax'));
        }).always(function () {
            //  アニメーション OFF
            if (!disableAnimeFlg) {
                anime(false);
            }
        });
    }

    // ブラウザが非対応な機能を表示する。
    function caniuse (object, name) {
        console.log(name + ': ', object);
        if (!object) {
            conversationFieldId.append(formatTag(answerTag, [getCharacter(), name + ' 非対応', '', '']));
        }
    }

    // マイクアイコンをアニメーションする。
    function microphoneIcon (recording) {
        if (recording) {
            microphoneIconId.addClass("text-danger animated infinite pulse");
            microphoneIconId.css({color: "#00ff00", "font-size": "160%"});
        } else {
            microphoneIconId.removeClass("text-danger animated infinite pulse");
            microphoneIconId.css({color: "", "font-size": ""});
        }
    }

    // ページをリロードする。
    $('#headerId').on('click', function () {
        location.href = '/';
    });

    // 音声認識ボタンクリック
    sttId.on('click', function () {
        recording = !recording;
        if (recording) {
            qId.focus();

            let param = {
                token: watsonSpeechContext.stt.token,
                model: 'ja-JP_BroadbandModel',
                outputElement: '#qId' // CSS selector or DOM Element
            };
            if (watsonSpeechContext.stt.customization_id) {
                param.customization_id = watsonSpeechContext.stt.customization_id;
            }
            stream = WatsonSpeech.SpeechToText.recognizeMicrophone(param);

            stream.on('error', function (err) {
                console.log('error', err);
                recording = false;
                microphoneIcon(recording);
            });

            stream.on('data', function (data) {
                if (data.results[0] && data.results[0].final) {
                    stream.stop();
                    console.log('stop listening.');
                    recording = false;
                    microphoneIcon(recording);
                }
            });

        } else {
            if (stream) {
                stream.stop();
            }
        }
        microphoneIcon(recording);
    });

    // フォームサブミット時
    searchFormId.on('submit', function () {
        const q = qId.val();
        if (q.replace(/\s/g, '') !== '') {
            // 音声認識を停止する。
            if (recording) {
                if (stream) {
                    stream.stop();
                }
                recording = false;
                microphoneIcon(recording);
            }

            // 入力項目をクリアする。
            qId.val('');

            // 質問を表示する。
            conversationFieldId.append(formatTag(questionTag, [q]));

            if (feedbackId) {
                dislike(q);
            } else {
                // Watson に問い合わせる。
                ask('ask', q);
            }
        }
        qId.focus();

        // サブミットせずに終了する。(画面遷移しない。)
        return false;
    });

    // 初期処理を実行する。
    (function () {
        // フォームを隠す。
        searchFormId.hide();
        // 音声認識ボタンを隠す。
        sttId.hide();
        //  アニメーション ON
        anime(true);
        // ブラウザが非対応な機能を表示する。
        caniuse(getUserMedia, 'getUserMedia API');

        // Watson Speech to text と Text to Speech を使用するための情報を取得する。
        $.ajax({
            "type": "GET",
            "url": "/watson-speech"
        }).done(function (value) {
            // getUserMedia 対応、且つ、iPad、iPhone でなければ音声認識ボタンを表示する。
            const ua = navigator.userAgent;
            if (getUserMedia && ua.indexOf('iPad') === -1 && ua.indexOf('iPhone') === -1) {
                sttId.show();
            }
            // 情報をコンテキストにセットする。
            watsonSpeechContext = value;
        }).fail(function (value) {
            console.log('error:', value);
            viewAnswer(getMessageJson('error_watson_auth'));
        }).always(function () {
            // 初回挨拶する。
            ask('class-name', 'general_hello', true);
            // フォームを表示する。
            searchFormId.show();
            //  アニメーション OFF
            searchFormId.show();
            anime(false);
        });
    })();
});