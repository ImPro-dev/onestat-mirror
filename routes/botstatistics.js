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
  { name: 'fb_stat', maxCount: 20 },
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

    var keitaroConversionsFile = path.join(__dirname, '..', 'uploads', webID, "___keitaroConversions.csv");
    var KTConvReader = fs.createReadStream(keitaroConversionsFile);
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
          try {
            subId1 = decodeURI(row[subId1Index].split('_Group_')[0]); // adname
          } catch (error) {
            subId1 = row[subId1Index].split('_Group_')[0]; // adname
          }
          subId = row[subIdIndex];
          origStatus = row[origStatusIndex];
          subId14 = row[subId14Index]

          if (subId1) {
            if (!aggregatedData[subId1]) {
              aggregatedData[subId1] = {
                subId: '',
                spend: 0,
                adStatus: '',
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
        fs.unlink(keitaroConversionsFile, (err) => {
          if (err) {
            console.error(`Error while file removing ${keitaroConversionsFile}:`, err);
          } else {
            console.log(`File ${keitaroConversionsFile} removed.`);
          }
        });

        // FB data
        var adname, adIndex, adFound;
        var spend, spendIndex, spendFound;
        var adStatus, adStatusIndex, adStatusFound;
        var adColumnNameRegex = config.FB.adColumnNameRegex;
        var spendColumnNameRegex = config.FB.spendColumnNameRegex;
        var spendColumnName = config.FB.spendColumnName;
        var adStatusColumnNameRegex = config.FB.adStatusColumnNameRegex;
        var adStatusColumnName = config.FB.adStatusColumnName;

        // Get all files in DIR
        const uploadDir = path.join(__dirname, "..", "uploads", webID);
        const files = fs.readdirSync(uploadDir).filter(file => file.startsWith("___FB_") && file.endsWith(".csv"));
        const records = [];

        async function processFiles() {
          const tasks = files.map(file => {
            return new Promise((resolve, reject) => {
              const filePath = path.join(uploadDir, file);
              const FBreader = fs.createReadStream(filePath);
              FBreader.pipe(parse({ delimiter: ",", from_line: 1 }))
                .on("data", function (row) {
                  // Header row. Find indexes
                  if (FBcvsRow == 1) {
                    row.forEach((columnName, index) => {
                      if (!adFound) {
                        adIndex = adColumnNameRegex.test(columnName) ? index : '';
                        adFound = adIndex === '' ? false : true;
                      }
                      if (!spendFound) {
                        spendIndex = spendColumnNameRegex.test(columnName) ? index : '';
                        spendFound = spendIndex === '' ? false : true;
                      }
                      if (!adStatusFound) {
                        adStatusIndex = adStatusColumnNameRegex.test(columnName) ? index : '';
                        adStatusFound = adStatusIndex === '' ? false : true;
                      }
                    });
                  } else {
                    try {
                      adname = decodeURI(row[adIndex].split('_Group_')[0]);
                    } catch (error) {
                      adname = row[adIndex].split('_Group_')[0];
                    }
                    spend = row[spendIndex];
                    adStatus = row[adStatusIndex];

                    if (aggregatedData[adname]) {
                      aggregatedData[adname].spend = spend.replace('.', ',');
                      aggregatedData[adname].adStatus = adStatus;
                    } else {
                      aggregatedData[adname] = {
                        subId: '',
                        spend: spend.replace('.', ','),
                        adStatus: adStatus,
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
                .on("end", function () {
                  console.log("FB stat finished");
                  fs.unlink(filePath, (err) => {
                    if (err) {
                      console.error(`Error while file removing ${file}:`, err);
                    } else {
                      console.log(`File ${file} removed.`);
                    }
                    resolve();
                  });
                })
                .on("error", function (error) {
                  console.log(error.message);
                  if (error.code == 'CSV_INVALID_CLOSING_QUOTE') {
                    req.flash('csvError', 'Переконайся, що завантажив файли в правильні поля');
                  } else if (error.code == 'INVALID_OPENING_QUOTE') {
                    req.flash('csvError', 'Переконайся, що завантажив правильні файли');
                  } else {
                    req.flash('csvError', 'Сталася помилка, звернись до Ігоря');
                  }
                  reject(error);
                  return res.redirect('/statistics');
                });
            });
          });

          const downloadDir = path.join(__dirname, '..', 'download', webID);
          fs.mkdirSync(downloadDir, { recursive: true });
          const csvWriter = createObjectCsvWriter({
            path: downloadDir + '/' + config.OneStatFileName,
            header: [
              { id: 'subId1', title: 'Adname' },
              { id: 'adStatus', title: 'Status' },
              { id: 'spend', title: 'Spend' },
              { id: 'new', title: 'New' },
              { id: 'reg', title: 'Reg' },
              { id: 'dep', title: 'Dep' },
              { id: 'qua', title: 'Qua' },
            ],
          });

          // Wait until files have been processed
          await Promise.all(tasks);

          for (const property in aggregatedData) {
            records.push({
              subId1: property,
              adStatus: config.FB.statusMapping[aggregatedData[property].adStatus],
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
              adStatus: adStatusColumnName,
              subID: subIdColumnName,
              spend: spendColumnName,
              new: newStatus,
              reg: regStatus,
              dep: depStatus,
              qua: quaStatus,
            },
            data: JSON.stringify(aggregatedData),
          });
        }

        processFiles().catch(err => console.error("Ошибка при обработке файлов:", err));
      })
      .on("error", function (error) {
        console.log(error.message);
        if (error.code == 'CSV_INVALID_CLOSING_QUOTE') {
          req.flash('csvError', 'Переконайся, що завантажив файли в правильні поля');
        } else if (error.code == 'INVALID_OPENING_QUOTE') {
          req.flash('csvError', 'Переконайся, що завантажив правильні файли');
        } else {
          req.flash('csvError', 'Сталася помилка, звернись до Ігоря');
        }
        return res.redirect('/statistics');
      });
  });

module.exports = router;
