/**
 *Q&A Chatbot: Feedback Log Model
 *
 * @module models/feedback-log.js
 * @author JIEC
 */

'use strict';

// モジュールを読込む。
const
    Cloudant = require('cloudant'),
    context = require('../utils/context');

// データベース名
const DATABASE_NAME = 'feedback_log';

// マップ定義: 一覧
const LIST = `function (doc) {
    var row = {
        "_id": doc._id,
        "_rev": doc._rev,
        "datetime": doc.datetime,
        "question": doc.question,
        "class_name": doc.class_name,
        "answer": doc.answer,
        "final_answer": doc.final_answer,
        "like": doc.like,
        "comment": doc.comment,
        "confidence": doc.confidence
    };
    emit(doc.datetime, row);
}`;

/**
 * 設計文書
 * @type {{_id: string, views: {list: {map: string}}, language: string}}
 */
exports.designDocument = {
    "_id": "_design/objects",
    "views": {
        "list": {
            "map": LIST
        }
    },
    "language": "javascript"
};

// Cloudant NoSQL DB サービスを作成する。
const cloudant = new Cloudant(context.cloudantCreds.url);

// データベースを使用する。
const database = cloudant.db.use(DATABASE_NAME);

/**
 * ビューを取得する。
 * @param designName {string} デザイン名
 * @param indexName {string} ビュー名
 * @param [params] {object} パラメータ
 * @return {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbviewdesignname-viewname-params-callback}
 */
exports.view = (designName, indexName, params) => {
    return new Promise((resolve, reject) => {
        if (checkParams(reject, [
                {object: designName, name: 'designName'},
                {object: indexName, name: 'indexName'}])) {
            try {
                database.view(designName, indexName, params, (error, value) => {
                    if (error) {
                        console.log('error;', error);
                        reject(error);
                    } else {
                        resolve(value);
                    }
                });
            } catch (e) {
                console.log('error;', e);
                reject(e);
            }
        }
    });
};

/**
 * 文書を作成する。
 * @param doc {object} 文書
 * @param [params] {string|object} パラメータ
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbinsertdoc-params-callback}
 */
exports.insert = (doc, params) => {
    return new Promise((resolve, reject) => {
        if (checkParams(reject, [
                {object: doc, name: 'doc'},
            ])) {
            try {
                database.insert(doc, params, (error, value) => {
                    if (error) {
                        console.log('error;', error);
                        reject(error);
                    } else {
                        resolve(value);
                    }
                });
            } catch (e) {
                console.log('error;', e);
                reject(e);
            }
        }
    });
};

/**
 * 文書を削除する。
 * @param docName {string} 文書名
 * @param rev {string} リビジョン
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbdestroydocname-rev-callback}
 */
exports.destroy = (docName, rev) => {
    return new Promise((resolve, reject) => {
        if (checkParams(reject, [
                {object: docName, name: 'docName'},
                {object: rev, name: 'rev'}
            ])) {
            try {
                database.destroy(docName, rev, (error, value) => {
                    if (error) {
                        console.log('error;', error);
                        reject(error);
                    } else {
                        resolve(value);
                    }
                });
            } catch (e) {
                console.log('error;', e);
                reject(e);
            }
        }
    });
};

/**
 * 文書を取得する。
 * @param docName {string} 文書名
 * @param [params] {string|object} パラメータ
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbgetdocname-params-callback}
 */
exports.get = (docName, params) => {
    return new Promise((resolve, reject) => {
        if (checkParams(reject, [
                {object: docName, name: 'docName'},
            ])) {
            try {
                database.get(docName, params, (error, value) => {
                    if (error) {
                        console.log('error;', error);
                        reject(error);
                    } else {
                        resolve(value);
                    }
                });
            } catch (e) {
                console.log('error;', e);
                reject(e);
            }
        }
    });
};

/**
 * 設計文書を作成する。
 * @param designDocument {object} 設計文書
 * @param [params] {string|object} パラメータ
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbinsertdoc-params-callback}
 */
exports.createDesignDocument = (designDocument, params) => {
    return new Promise((resolve, reject) => {
        if (checkParams(reject, [
                {object: designDocument, name: 'designDocument'},
            ])) {
            try {
                database.insert(designDocument, params, (error, value) => {
                    if (error) {
                        console.log('error;', error);
                        reject(error);
                    } else {
                        resolve(value);
                    }
                });
            } catch (e) {
                console.log('error;', e);
                reject(e);
            }
        }
    });
};

/**
 * データベースを作成する。
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#nanodbcreatename-callback}
 */
exports.createDatabase = () => {
    return new Promise((resolve, reject) => {
        try {
            cloudant.db.create(DATABASE_NAME, (error, value) => {
                if (error) {
                    console.log('error;', error);
                    reject(error);
                } else {
                    resolve(value);
                }
            });
        } catch (e) {
            console.log('error;', e);
            reject(e);
        }
    });
};

/**
 * データベースを削除する。
 * @returns {Promise}
 * @see {@link https://github.com/cloudant-labs/cloudant-nano#nanodbdestroyname-callback}
 */
exports.destroyDatabase = () => {
    return new Promise((resolve, reject) => {
        try {
            cloudant.db.destroy(DATABASE_NAME, (error, value) => {
                if (error) {
                    console.log('error;', error);
                    reject(error);
                } else {
                    resolve(value);
                }
            });
        } catch (e) {
            console.log('error;', e);
            reject(e);
        }
    });
};

// パラメータをチェックする。
function checkParams (reject, params) {
    let isOk = true;
    for (let param of params) {
        if (!param.object) {
            isOk = false;
            const error = {"ok": isOk};
            console.log('error:', param.name, error);
            reject(error);
            break;
        }
    }
    return isOk;
}