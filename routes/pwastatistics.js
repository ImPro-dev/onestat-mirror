const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { parse } = require("csv-parse");

const config = require('../config/statConfig')
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const fields = [
  { name: 'fb_stat', maxCount: 1 },
  { name: 'keitaro_stat_conversions', maxCount: 1 },
  { name: 'keitaro_stat_clicks', maxCount: 1 }
];

/* GET form data. */
router.post('/',
  auth,
  upload.fields(fields), function (req, res, next) {
    var aggregatedData = {};
    var FBcvsRow = 1;
    var KTConvCvsRow = 1;
    var KTClicksCvsRow = 1;
    var webID = res.locals.webID;

    // Keitaro data
    var keitaroData = config.Keitaro;
    var subIdColumnName = keitaroData.subId;
    var origStatusColumnName = keitaroData.origStatus;
    var subId1ColumnName = keitaroData.subId1;
    var installStatus = keitaroData.install;
    var regStatus = keitaroData.reg;
    var depStatus = keitaroData.dep;
    var quaStatus = keitaroData.qua;

    var subId, subIdIndex, subIdFound;
    var origStatus, origStatusIndex, origStatusFound;
    var subId1, subId1Index, subId1Found;

    // var KTClicksReader = fs.createReadStream("uploads/___keitaroClicks.csv");
    var KTClicksReader = fs.createReadStream(path.join(__dirname, '..', 'uploads', webID, "___keitaroClicks.csv"));
    KTClicksReader.pipe(parse({ delimiter: ";", from_line: 1 }))
      .on("data", function (row) {
        // Header row. Define indexes
        if (KTClicksCvsRow == 1) {
          row.forEach((columnName, index) => {
            if (!subIdFound) {
              subIdIndex = columnName === subIdColumnName ? index : '';
              subIdFound = !!subIdIndex;
            }
            if (!subId1Found) {
              subId1Index = columnName === subId1ColumnName ? index : '';
              subId1Found = !!subId1Index;
            }
          });
        } else {
          // Fill out data rows
          subId1 = row[subId1Index]; // adname
          subId = row[subIdIndex];

          if (subId1) {
            if (!aggregatedData[subId1]) {
              aggregatedData[subId1] = {
                subId: '',
                spend: 0,
                install: {
                  value: 0,
                  subId: [],
                  doubles: 0
                },
                reg: {
                  value: 0,
                  subId: [],
                  doubles: 0
                },
                dep: {
                  value: 0,
                  subId: [],
                  doubles: 0
                },
                qua: {
                  value: 0,
                  subId: [],
                  doubles: 0
                },
              };
            }

            // aggregatedData[subId1].subId = subId;
            if (aggregatedData[subId1][installStatus].subId.indexOf(subId) === -1) {
              aggregatedData[subId1][installStatus].subId.push(subId);
              aggregatedData[subId1][installStatus].value += 1;
            } else {
              aggregatedData[subId1][installStatus].doubles += 1;
            }
          }
        }
        console.log(row);
        KTClicksCvsRow++;
      })
      .on("end", function () {
        console.log("Keitaro Clicks stat finished");
        var adname, adIndex, adFound;
        var spend, spendIndex, spendFound;
        subIdIndex = null;
        subIdFound = null;
        subId1Index = null;
        subId1Found = null;

        // var KTConvReader = fs.createReadStream("uploads/___keitaroConversions.csv");
        var KTConvReader = fs.createReadStream(path.join(__dirname, '..', 'uploads', webID, "___keitaroConversions.csv"));
        KTConvReader.pipe(parse({ delimiter: ";", from_line: 1 }))
          .on("data", function (row) {
            try {
              // Header row. Define indexes
              if (KTConvCvsRow == 1) {
                row.forEach((columnName, index) => {
                  if (!subIdFound) {
                    subIdIndex = columnName === subIdColumnName ? index : '';
                    subIdFound = !!subIdIndex;
                  }
                  if (!origStatusFound) {
                    origStatusIndex = columnName === origStatusColumnName ? index : '';
                    origStatusFound = !!origStatusIndex;
                  }
                  if (!subId1Found) {
                    subId1Index = columnName === subId1ColumnName ? index : '';
                    subId1Found = !!subId1Index;
                  }
                });
              } else {
                // Fill out data rows
                subId1 = row[subId1Index]; // adname
                subId = row[subIdIndex];
                origStatus = row[origStatusIndex];

                if (subId1) {
                  if (!aggregatedData[subId1]) {
                    aggregatedData[subId1] = {
                      subId: '',
                      spend: 0,
                      install: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      reg: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      dep: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      qua: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                    };
                  }

                  // aggregatedData[subId1].subId = subId;
                  if (aggregatedData[subId1][origStatus].subId.indexOf(subId) === -1) {
                    aggregatedData[subId1][origStatus].subId.push(subId);
                    aggregatedData[subId1][origStatus].value += 1;
                  } else {
                    aggregatedData[subId1][origStatus].doubles += 1;
                  }
                }
              }
            } catch (error) {
              console.error(error);
            }
            console.log(row);
            KTConvCvsRow++;
          })
          .on("end", function () {
            console.log("Keitaro stat finished");
            // FB data
            var adColumnName = config.FB.adColumnName;
            var adColumnName_ua = config.FB.adColumnName_ua;
            var spendColumnName = config.FB.spendColumnName;
            var spendColumnName_ua = config.FB.spendColumnName_ua;

            // var FBreader = fs.createReadStream("uploads/___FB.csv");
            var FBreader = fs.createReadStream(path.join(__dirname, '..', 'uploads', webID, "___FB.csv"));
            FBreader.pipe(parse({ delimiter: ",", from_line: 1 }))
              .on("data", function (row) {
                // Header row. Find indexes
                if (FBcvsRow == 1) {
                  row.forEach((columnName, index) => {
                    if (!adFound) {
                      adIndex = (columnName === adColumnName || columnName === adColumnName_ua) ? index : '';
                      adFound = !!adIndex;
                    }
                    if (!spendFound) {
                      spendIndex = (columnName === spendColumnName || columnName === spendColumnName_ua) ? index : '';
                      spendFound = !!spendIndex;
                    }
                  });
                } else {
                  adname = row[adIndex];
                  spend = row[spendIndex];

                  if (aggregatedData[adname]) {
                    aggregatedData[adname].spend = spend.replace('.', ',');
                  } else {
                    aggregatedData[adname] = {
                      subId: '',
                      spend: spend.replace('.', ','),
                      install: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      reg: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      dep: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                      qua: {
                        value: 0,
                        subId: [],
                        doubles: 0
                      },
                    }
                  }
                }
                console.log(row);
                FBcvsRow++;
              })
              .on("end", async () => {
                console.log("FB stat finished");

                const fileName = config.OneStatFileName;
                // const filePath = path.join(__dirname, '..', 'download', webID);
                // const fileName = config.OneStatFileName;

                const filePath = path.join(__dirname, '..', 'download', webID);
                fs.mkdirSync(filePath, { recursive: true });
                const csvWriter = createObjectCsvWriter({
                  path: filePath + '/' + fileName,
                  header: [
                    { id: 'subId1', title: 'Adname' },
                    { id: 'spend', title: 'Spend' },
                    { id: 'install', title: 'Install' },
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
                    install: aggregatedData[property].install.value + (aggregatedData[property].install.doubles ? '|' + aggregatedData[property].install.doubles : ''),
                    reg: aggregatedData[property].reg.value + (aggregatedData[property].reg.doubles ? '|' + aggregatedData[property].reg.doubles : ''),
                    dep: aggregatedData[property].dep.value + (aggregatedData[property].dep.doubles ? '|' + aggregatedData[property].dep.doubles : ''),
                    qua: aggregatedData[property].qua.value + (aggregatedData[property].qua.doubles ? '|' + aggregatedData[property].qua.doubles : ''),
                  });
                }

                await csvWriter.writeRecords(records);

                res.render('pwastatistics', {
                  title: 'OneStat',
                  resultTitle: 'OneStat result:',
                  headers: {
                    adname: subId1ColumnName,
                    subID: subIdColumnName,
                    spend: spendColumnName,
                    install: installStatus,
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
                  req.flash('csvError', 'Сталася помилка, звернись до Ігоря');
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
              req.flash('csvError', 'Сталася помилка, звернись до Ігоря');
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
          req.flash('csvError', 'Сталася помилка, звернись до Ігоря');
        }
        return res.redirect('/statistics');
      });

  });

module.exports = router;
