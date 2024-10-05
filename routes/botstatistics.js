const express = require('express');
const router = express.Router();
const fs = require("fs");
const { createObjectCsvWriter } = require('csv-writer');
const { parse } = require("csv-parse");

const config = require('../config/config')
const upload = require('../middleware/upload');
const fields = [
  { name: 'fb_stat', maxCount: 1 },
  { name: 'keitaro_stat_conversions', maxCount: 1 }
];



/* GET form data. */
router.post('/', upload.fields(fields), function (req, res, next) {
  var aggregatedData = {};
  var FBcvsRow = 1;
  var KTcvsRow = 1;

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

  var KTConvReader = fs.createReadStream("uploads/___keitaroConversions.csv");
  KTConvReader.pipe(parse({ delimiter: ";", from_line: 1 }))
    .on("data", function (row) {
      // Header row. Define indexes
      if (KTcvsRow == 1) {
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
          if (!subId14Found) {
            subId14Index = columnName === subId14ColumnName ? index : '';
            subId14Found = !!subId14Index;
          }
        });
      } else {
        // Fill out data rows
        subId1 = row[subId1Index]; // adname
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
            };
          }

          aggregatedData[subId1].subId = subId;

          if (aggregatedData[subId1][origStatus].subId14.indexOf(subId14) === -1) {
            aggregatedData[subId1][origStatus].subId14.push(subId14);
            aggregatedData[subId1][origStatus].value += 1;
          } else {
            aggregatedData[subId1][origStatus].doubles += 1;
          }
        }
      }
      console.log(row);
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
      var spendColumnName_ua = config.FB.spendColumnName_ua;
      
      var FBreader = fs.createReadStream("uploads/___FB.csv");
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
          console.log(row);
          FBcvsRow++;
        })
        .on("end", async () => {
          console.log("FB stat finished");

          const fileName = config.OneStatFileName;
          const csvWriter = createObjectCsvWriter({
            path: 'download/' + fileName,
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

          res.render('botstatistics', { 
            title: 'OneStat',
            resultTitle: 'OneStat result:',
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
        });
    })
    .on("error", function (error) {
      console.log(error.message);
    });
});

module.exports = router;
