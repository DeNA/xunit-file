/**
 * Module dependencies.
 */

var mocha = require("mocha")
  , Base = mocha.reporters.Base
  , utils = mocha.utils
  , escape = utils.escape
  , config = require("../config.json")
  , fs = require("fs")
  , filePath = process.env.XUNIT_FILE || config.file || process.cwd() + "/xunit.xml"
  , fd = fs.openSync(filePath, 'w', 0755)
  , consoleOutput = config.consoleOutput || {};

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */

var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval;

/**
 * Expose `XUnitFile`.
 */

exports = module.exports = XUnitFile;

/**
 * Initialize a new `XUnitFile` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function XUnitFile(runner) {
  Base.call(this, runner);
  var stats = this.stats
    , tests = []
    , self = this;

  runner.on('test', function(test){
    test.originalConsoleLog = console.log;
    test.logs = new Array();
        
    console.log = function() {
      var tm = moment().format("MM-DD HH:mm:ss.SSS");
      var str = '[' + tm + '] ' + util.format.apply(this, arguments) + '\n';
      test.logs.push(str);
    };
  });

  runner.on('test end', function(test){
    console.log = test.originalConsoleLog;
  });

  runner.on('pass', function(test){
    tests.push(test);
  });

  runner.on('fail', function(test){
    tests.push(test);
  });

  runner.on('pending', function(test) {
    tests.push(test);
  });

  runner.on('suite end', function(suite){
    
    appendLine(tag('testsuite', {
        name: suite.title
      , tests: stats.tests
      , failures: stats.failures
      , errors: stats.failures
      , skipped: stats.tests - stats.failures - stats.passes
      , timestamp: (new Date).toUTCString()
      , time: stats.duration / 1000
    }, false));

    tests.forEach(outputTest);
    appendLine('</testsuite>');
    fs.closeSync(fd);
  });
}

/**
 * Inherit from `Base.prototype`.
 */

XUnitFile.prototype.__proto__ = Base.prototype;

/**
 * Output tag for the given `test.`
 */

function outputTest(test) {
  var attrs = {
      classname: test.parent.fullTitle()
    , name: test.title
    // , time: test.duration / 1000 //old
    ,time: test.duration ? test.duration / 1000 : 0 //new
  };

  var systemOut = test.logs.reduce(function(previousValue, currentValue, index, array){
    return previousValue + currentValue;
  });
  var systemOutTag = tag('system-out', {}, false, cdata(systemOut));

  if ('failed' == test.state) {
    var err = test.err;
    var failTag = tag('failure', { message: escape(err.message) }, false, cdata(err.stack));
    systemOutTag += failTag;
  } else if (test.pending) {
    delete attrs.time;
    systemOutTag += tag('skipped', {}, true);
  }

  var testcaseTag = tag('testcase', attrs, false, systemOutTag);
  appendLine(testcaseTag);
}

/**
 * HTML tag helper.
 */

function tag(name, attrs, close, content) {
  var end = close ? '/>' : '>'
    , pairs = []
    , tag;

  for (var key in attrs) {
    pairs.push(key + '="' + escape(attrs[key]) + '"');
  }

  tag = '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + end;
  if (content) tag += content + '</' + name + end;
  return tag;
}

/**
 * Return cdata escaped CDATA `str`.
 */

function cdata(str) {
  return '<![CDATA[' + escape(str) + ']]>';
}

function appendLine(line) {
    fs.writeSync(fd, line + "\n", null, 'utf8');
}
