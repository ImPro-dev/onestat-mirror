'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { parse } = require("csv-parse");
const auth = require('../middleware/auth');

const config = require('../config/statConfig')
const upload = require('../middleware/upload');
const fields = [
  { name: 'fb_stat', maxCount: 1 },
  { name: 'keitaro_stat_conversions', maxCount: 1 }
];

/* GET form data. */
router.post('/',
  auth,
  upload.fields(fields), function (req, res, next) {
    var aggregatedData = {};
    var FBcvsRow = 1;
    var KTcvsRow = 1;
    var webID = res.locals.webID;

    // Keitaro data
    var keitaroData = config.Keitaro;
    var subIdColumnName = keitaroData.subId;
    var origStatusColumnName = keitaroData.origStatus;
    var subId1ColumnName = keitaroData.subId1;
    var subId14ColumnName = keitaroData.subId14;
    var newStatus = keitaroData.new;
    var regStatus = keitaroData.reg;
    var depStatus = keitaroData.dep;
    var quaStatus = keitaroData.qua;

    var subId, subIdIndex, subIdFound;
    var origStatus, origStatusIndex, origStatusFound;
    var subId1, subId1Index, subId1Found;
    var subId14, subId14Index, subId14Found;

    var KTConvReader = fs.createReadStream(path.join(__dirname, '..', 'uploads', webID, "___keitaroConversions.csv"));
    KTConvReader.pipe(parse({ delimiter: ";", from_line: 1 }))
      .on("data", function (row) {
        // Header row. Define indexes
        if (KTcvsRow == 1) {
          row.forEach((columnName, index) => {
            if (!subIdFound) {
              subIdIndex = columnName.toLowerCase() === subIdColumnName.toLowerCase() ? index : '';
              subIdFound = subIdIndex === '' ? false : true;
            }
            if (!origStatusFound) {
              origStatusIndex = columnName.toLowerCase() === origStatusColumnName.toLowerCase() ? index : '';
              origStatusFound = origStatusIndex === '' ? false : true;
            }
            if (!subId1Found) {
              subId1Index = columnName.toLowerCase() === subId1ColumnName.toLowerCase() ? index : '';
              subId1Found = subId1Index === '' ? false : true;
            }
            if (!subId14Found) {
              subId14Index = columnName.toLowerCase() === subId14ColumnName.toLowerCase() ? index : '';
              subId14Found = subId14Index === '' ? false : true;
            }

            if (!subIdFound || !origStatusFound || !subId1Found) {
              return;
            }
          });
        } else {
          // Fill out data rows
          subId1 = decodeURI(row[subId1Index]); // adname
          subId = row[subIdIndex];
          origStatus = row[origStatusIndex];
          subId14 = row[subId14Index]

          if (subId1) {
            if (!aggregatedData[subId1]) {
              aggregatedData[subId1] = {
                subId: '',
                spend: 0,
                new: {
                  value: 0,
                  subId14: [],
                  doubles: 0
                },
                reg: {
                  value: 0,
                  subId14: [],
                  doubles: 0
                },
                dep: {
                  value: 0,
                  subId14: [],
                  doubles: 0
                },
                qua: {
                  value: 0,
                  subId14: [],
                  doubles: 0
                },
                subId14: '',
                '_': {
                  value: 0,
                  subId14: [],
                  doubles: 0
                },
              };
            }

            aggregatedData[subId1].subId = subId;

            // Ignore all the other statuses (empty, '1', etc.)
            if ([newStatus, regStatus, depStatus, quaStatus].indexOf(origStatus) === -1) {
              origStatus = '_';
            }

            if (aggregatedData[subId1][origStatus].subId14.indexOf(subId14) === -1) {
              aggregatedData[subId1][origStatus].subId14.push(subId14);
              aggregatedData[subId1][origStatus].value += 1;
            } else {
              aggregatedData[subId1][origStatus].doubles += 1;
            }
          }
        }
        KTcvsRow++;
      })
      .on("end", function () {
        console.log("Keitaro Conversions stat finished");
        // FB data
        var adname, adIndex, adFound;
        var spend, spendIndex, spendFound;
        var adColumnName = config.FB.adColumnName;
        var adColumnName_ua = config.FB.adColumnName_ua;
        var spendColumnName = config.FB.spendColumnName;
        var spendRegex = config.FB.spendRegex;
        var spendRegex_ua = config.FB.spendRegex_ua;

        // var FBreader = fs.createReadStream("uploads/___FB.csv");
        var FBreader = fs.createReadStream(path.join(__dirname, '..', 'uploads', webID, "___FB.csv"));
        FBreader.pipe(parse({ delimiter: ",", from_line: 1 }))
          .on("data", function (row) {
            // Header row. Find indexes
            if (FBcvsRow == 1) {
              row.forEach((columnName, index) => {
                if (!adFound) {
                  adIndex = (columnName.toLowerCase() === adColumnName.toLowerCase()
                    || columnName.toLowerCase() === adColumnName_ua.toLowerCase()) ? index : '';
                  adFound = adIndex === '' ? false : true;
                }
                if (!spendFound) {
                  spendIndex = (spendRegex.test(columnName) || spendRegex_ua.test(columnName)) ? index : '';
                  spendFound = spendIndex === '' ? false : true;
                }
              });
            } else {
              adname = decodeURI(row[adIndex]);
              spend = row[spendIndex];

              if (aggregatedData[adname]) {
                aggregatedData[adname].spend = spend.replace('.', ',');
              } else {
                aggregatedData[adname] = {
                  subId: '',
                  spend: spend.replace('.', ','),
                  new: {
                    value: 0,
                    subId14: [],
                    doubles: 0
                  },
                  reg: {
                    value: 0,
                    subId14: [],
                    doubles: 0
                  },
                  dep: {
                    value: 0,
                    subId14: [],
                    doubles: 0
                  },
                  qua: {
                    value: 0,
                    subId14: [],
                    doubles: 0
                  },
                  subId14: '',
                }
              }
            }
            FBcvsRow++;
          })
          .on("end", async () => {
            console.log("FB stat finished");

            const fileName = config.OneStatFileName;
            // const filePath = path.join(__dirname, '..', 'download', webID);
            const filePath = path.join(__dirname, '..', 'download', webID);
            fs.mkdirSync(filePath, { recursive: true });
            const csvWriter = createObjectCsvWriter({
              path: filePath + '/' + fileName,
              header: [
                { id: 'subId1', title: 'Adname' },
                { id: 'spend', title: 'Spend' },
                { id: 'new', title: 'New' },
                { id: 'reg', title: 'Reg' },
                { id: 'dep', title: 'Dep' },
                { id: 'qua', title: 'Qua' },
              ],
            });

            var records = [];
            for (const property in aggregatedData) {
              records.push({
                subId1: property,
                spend: aggregatedData[property].spend,
                new: aggregatedData[property].new.value + (aggregatedData[property].new.doubles ? '|' + aggregatedData[property].new.doubles : ''),
                reg: aggregatedData[property].reg.value + (aggregatedData[property].reg.doubles ? '|' + aggregatedData[property].reg.doubles : ''),
                dep: aggregatedData[property].dep.value + (aggregatedData[property].dep.doubles ? '|' + aggregatedData[property].dep.doubles : ''),
                qua: aggregatedData[property].qua.value + (aggregatedData[property].qua.doubles ? '|' + aggregatedData[property].qua.doubles : ''),
              });
            }

            await csvWriter.writeRecords(records);

            res.render('pages/manual_statistics/botstatistics', {
              title: 'OneBot Статистика',
              resultTitle: 'Зведені дані:',
              headers: {
                adname: subId1ColumnName,
                subID: subIdColumnName,
                spend: spendColumnName,
                new: newStatus,
                reg: regStatus,
                dep: depStatus,
                qua: quaStatus,
              },
              data: JSON.stringify(aggregatedData),
            });
          })
          .on("error", function (error) {
            console.log(error.message);
            if (error.code == 'CSV_INVALID_CLOSING_QUOTE') {
              req.flash('csvError', 'Переконайся, що завантажив файли в правильні поля');
            } else if (error.code == 'INVALID_OPENING_QUOTE') {
              req.flash('csvError', 'Переконайся, що завантажив правильні файли');
            } else {
              req.flash('csvError', 'Сталася помилка, звернись до адміністратора');
            }
            return res.redirect('/statistics');
          });
      })
      .on("error", function (error) {
        console.log(error.message);
        if (error.code == 'CSV_INVALID_CLOSING_QUOTE') {
          req.flash('csvError', 'Переконайся, що завантажив файли в правильні поля');
        } else if (error.code == 'INVALID_OPENING_QUOTE') {
          req.flash('csvError', 'Переконайся, що завантажив правильні файли');
        } else {
          req.flash('csvError', 'Сталася помилка, звернись до адміністратора');
        }
        return res.redirect('/statistics');
      });
  });

module.exports = router;
