'use strict';

// these need to be updated with a real username and password to use them
const GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'http://<username>:<password>@mazemasterjs.com/game';
const TEAM_SERVER_URL = process.env.TEAM_SERVER_URL || 'http://<username>:<password>@mazemasterjs.com/api/team';
const SCORE_SERVER_URL = process.env.SCORE_SERVER_URL || 'http://<username>:<password>@mazemasterjs.com/score';
const MONITOR_SERVER_URL = process.env.MONITOR_SERVER_URL || 'http://<username>:<password>@mazemasterjs.com/';

// some enums we need
const LOG_TYPES = {
    BOT: 'bot',
    WARN: 'wrn',
    ERROR: 'err',
};

var PLAYER_STATES = {
    NONE: 0,
    STANDING: 1,
    SITTING: 2,
    LYING: 4,
    STUNNED: 8,
    BLIND: 16,
    BURNING: 32,
    LAMED: 64,
    BEARTRAPPED: 128,
    SLOWED: 256,
    DEAD: 512,
    POISONED: 1024,
};

var DIRS = {
    NONE: 0,
    NORTH: 1,
    SOUTH: 2,
    EAST: 4,
    WEST: 8,
    LEFT: 16,
    RIGHT: 32,
};
var DIRECTIONS = DIRS;

var COMMANDS = {
    NONE: 0,
    FACE: 1,
    LISTEN: 2,
    LOOK: 3,
    SIT: 4,
    SNIFF: 5,
    STAND: 6,
    TURN: 7,
    MOVE: 8,
    JUMP: 9,
    WAIT: 10,
    WRITE: 11,
    QUIT: 12,
    SNEAK: 13,
};
var CMDS = COMMANDS;


/*
 *
 * ==========================================================
 * WARNING -  WARNING - WARNING - WARNING - WARNING - WARNING
 * ==========================================================
 * 
 *               KIDS: DO NOT CHANGE THIS FILE
 
 * ==========================================================
 * WARNING -  WARNING - WARNING - WARNING - WARNING - WARNING
 * ==========================================================
 * 
 */

delete require.cache['Logger.js'];
delete require.cache['data/data.json'];

// load utilities
require('dotenv').config();
var LoggerJS = require('./Logger.js');
var UtilJS = require('util');
var fs = require('fs'); // file system - allows reading and writing files
var BootstrapData =
{
    // these can be overridden by the camper's data file
    runAllBots: true,
    singleBotToRun: null,
    specificMaze: null,
    startAtBeginningOfMazeList: false,

    // set at the repository level, shouldn't be changed by teams
    //teamName: "The Dev Team",             // Instructor Team
    teamName: "The Fabulous Five",        // Team #1 // to HorHik
    //teamName: "Dazzling Developers",      // Team #2 // to SimShu
    //teamName: "Code-A-Licious",           // Team #3 // to WinWal
    //teamName: "The Binary Breakers",      // Team #4 // to SimShu
    //teamName: "The Dreidels",             // Team #5 // to WinWal
    //teamName: "The Bot Masters",          // Team #6 // to HorHik
    mazes: [
        '5:5:1:HarHal_v1.0.0',
        '5:5:1:BalBen_v1.0.0',
        '3:3:1:TinTre_v1.0.0',
        '3:5:1:MinMar_v1.0.0',
        '5:5:2:ShoStr_v1.0.0',
        '5:10:3:WinWal_v1.0.0',
        '10:10:3:SimShu_v1.0.0',
        '10:15:4:TerTra_v1.0.0',
        '15:15:4:HorHik_v1.0.0',
        '15:20:4:JarJog_v1.0.0',
        '20:20:5:TurTro_v1.0.0',
        '20:25:5:PaiPro_v1.0.0',
        '25:25:6:SeaSpr_v1.0.0',
        '25:30:6:DeaDas_v1.0.0',
        '30:30:7:TorTou_v1.0.0',
        '30:35:7:MisMil_v1.0.0',
        '35:35:8:BoiBou_v1.0.0',
        '35:40:8:PaiPac_v1.0.0',
        '40:40:9:GanGal_v1.0.0',
        '40:45:9:FeaFli_v1.0.0',
        '45:45:10:WitWan_v1.0.0',
        '45:50:10:RidRam_v1.0.0',
        '50:50:10:FarFol_v1.0.0',
        '60:60:10:SisStr_v1.0.0',
    ],
    minimumCycleTime: 10,
    numberOfBots: 6,
};

// clear the cache
if (fs.existsSync("botCache")) {
    fs.readdirSync("botCache").forEach(function (file, index) {
        var curPath = "botCache/" + file;
        fs.unlinkSync(curPath);
    });

    fs.rmdirSync("botCache");
}
fs.mkdirSync("botCache");

var CodeCampBots = [];
var lastActionResult;
var BOT_RAM = {};
var g_currentBotLoad = 0;
var g_currentBotRun = 0;

// configure the logger
var logger = LoggerJS.Logger.getInstance(); // simple logging wrapper
logger.setLogLevel(LoggerJS.LOG_LEVELS["DEBUG"]);
logger.trace(__filename, '', 'Logger initialized...');

if (fs.existsSync('./data/data.json')) {
    logger.debug(__filename, '', 'Override data exists, loading...');
    var OverrideData = require('./data/data');

    // override Bootstrap data
    if (OverrideData.runOneBot === true &&
        null != OverrideData.botToRun &&
        OverrideData.botToRun > 0 &&
        OverrideData.botToRun <= BootstrapData.numberOfBots) {
        logger.debug(__filename, '', UtilJS.format('Running only bot #%d.', OverrideData.botToRun));
        BootstrapData.runAllBots = false;
        BootstrapData.singleBotToRun = OverrideData.botToRun;
    }
    if (OverrideData.specificMaze != null) {
        logger.debug(__filename, '', UtilJS.format('Running only maze %s.', OverrideData.specificMaze));
        BootstrapData.specificMaze = OverrideData.specificMaze;
    } else if (OverrideData.playAllMazes === true) {
        logger.debug(__filename, '', 'Running all mazes.');
        BootstrapData.startAtBeginningOfMazeList = true;
    }
    if (OverrideData.logLevel != null &&
        (OverrideData.logLevel == "NONE" || OverrideData.logLevel == "ERROR" ||
            OverrideData.logLevel == "WARN" || OverrideData.logLevel == "INFO" ||
            OverrideData.logLevel == "DEBUG" || OverrideData.logLevel == "TRACE")) {
        logger.debug(__filename, '', UtilJS.format('Setting log level to %s.', OverrideData.logLevel));
        logger.setLogLevel(LoggerJS.LOG_LEVELS[OverrideData.logLevel]);
    }
    if (OverrideData.openGameMonitor != null && OverrideData.openGameMonitor === true) {
        logger.debug(__filename, '', 'Opening Chrome on launch.');
        BootstrapData.launchChrome = true;
    }
}

// Load the required modules
logger.trace(__filename, '', 'Load "request" library...');
var req = require('request');

// BASIC FLOW
//   1. Find our Team ID from BootstrapData.teamName
//   2. Parse active games to see if we already have one so we can stop it
//   3. Examine the score history to find out which maze in BootstrapData.mazes we have not yet solved
//        - if we're given a specific maze, just use that one
//        - if we're told to start at the beginning, do so
//        - if we've beat them all, ABEND!
//   4. Create a game for the next maze we need to solve
//   5. Play the game, simple request/response cycle calling the bots
//   6. Once we solve the maze, go back to Step #3

// try to find this team
logger.trace(__filename, '', "Retrieving team list...");
makeRequest(TEAM_SERVER_URL + '/get/', FindMyTeam);

function FindMyTeam(error, response, body) {
    logger.debug(__filename, 'FindMyTeam()', 'Entry Point');

    if (undefined != error) {
        logger.error(__filename, 'FindMyTeam()', UtilJS.format('Error retrieving list of teams: %s' + error));
        logger.debug(__filename, 'FindMyTeam()', 'ABEND!');
        process.exit(1);
    }

    logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Parsing JSON: %s', body));
    var teamList = JSON.parse(body);

    logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Searching %d teams for "%s"...', teamList.length, BootstrapData.teamName));
    var teamFound = false;
    for (var currentTeam = 0; currentTeam < teamList.length; currentTeam++) {
        logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Team #%d is "%s"', currentTeam, teamList[currentTeam].name));

        if (BootstrapData.teamName == teamList[currentTeam].name) {
            logger.debug(__filename, 'FindMyTeam()', UtilJS.format('Found "%s" with ID %s', BootstrapData.teamName, teamList[currentTeam].id));
            BootstrapData.teamId = teamList[currentTeam].id;
            BootstrapData.botData = teamList[currentTeam].bots;
            teamFound = true;
            break; // we're done searching!
        }
    }

    if (!teamFound) {
        logger.error(__filename, 'FindMyTeam()', UtilJS.format('Could not locate a team with name "%s"!', BootstrapData.teamName));
        logger.debug(__filename, 'FindMyTeam()', 'ABEND!');
        process.exit(1);
    }

    LoadBots(null, null, null);

    logger.debug(__filename, 'FindMyTeam()', 'Exit Point');
}

function botCodeToFunction(botCode) {
    const injectTag = ' // @INJECTED\n';
    const strictScript = '"use strict";' + injectTag;
    const gdDeclareScript = 'let GameData = {};' + injectTag;
    const debugStart = `\ngoBot(reformatData(lastActionResult));${injectTag}`;
    const stepStart = `\ngoBot(reformatData(lastActionResult));${injectTag}`;
    const loopStart = `\ngoBot(reformatData(lastActionResult))${injectTag}`;
    const gdMapScript = '\nObject.assign(GameData, data);' + injectTag;
    const debugScript = '\ndebugger;' + injectTag;

    // inject script values appropriate to the run time selected
    const insKey = 'function goBot(data) {';
    const insAt = botCode.indexOf(insKey);
    const bcTop = botCode.substr(0, insAt + insKey.length);
    const bcBot = botCode.substr(insAt + insKey.length);
    botCode = bcTop + gdMapScript + bcBot;
    botCode = botCode.replace(/debugger;/g, '');
    botCode = botCode + loopStart;

    // force use of strict mode
    if (botCode.indexOf('"use strict";') === -1) {
        botCode = strictScript + gdDeclareScript + botCode;
    } else {
        botCode = gdDeclareScript + botCode;
    }

    try {
        // convert the bot text to a js function
        //const botFn = new Function(botCode);
        var botFn;
        eval("botFn = function() {" + botCode + "};");
        return botFn;
    } catch (botCodeErr) {
        logger.error(__filename, 'botCodeToFunction()', 'Fatal error loading bot #' + g_currentBotLoad + "; " + botCodeErr);
        process.exit(1);
    }
}

function LoadBots(error, response, body) {
    if (null != body) {
        if (undefined != error) {
            logger.debug(__filename, 'LoadBots()', 'error!');
            process.exit(1);
        }

        var botCodeData = JSON.parse(body);

        fs.writeFileSync("./botCache/bot-" + g_currentBotLoad + ".js", botCodeData[botCodeData.length - 1].code);

        CodeCampBots[g_currentBotLoad] = {};
        CodeCampBots[g_currentBotLoad].botFn = botCodeToFunction(botCodeData[botCodeData.length - 1].code);
        CodeCampBots[g_currentBotLoad].BOT_RAM = {};

        BootstrapData.numberOfBots = g_currentBotLoad + 1;

        g_currentBotLoad++;
    }

    if (g_currentBotLoad < BootstrapData.botData.length) {
        var strURL = TEAM_SERVER_URL + '/get/botCode?botId=' + BootstrapData.botData[g_currentBotLoad].id;
        makeRequest(strURL, LoadBots);
    }
    else {
        // is there already an active game for this team?
        logger.trace(__filename, 'FindMyTeam()', 'Looking for active games now...');
        makeRequest(GAME_SERVER_URL + '/get/', ParseActiveGames);
    }
}

function ParseActiveGames(error, response, body) {
    logger.debug(__filename, 'ParseActiveGames()', 'Entry Point');
    if (undefined != error) {
        logger.error(__filename, 'ParseActiveGames()', UtilJS.format('Error retrieving list of active games: %s' + error));
        logger.debug(__filename, 'ParseActiveGames()', 'ABEND!');
        process.exit(1);
    }

    logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Parsing JSON: %s', body));
    var games = JSON.parse(body);
    var gameFound = false;
    logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Checking %d games returned from server...', games.length));
    for (var currentGame = 0; currentGame < games.length; currentGame++) {
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Checking game #%d with id %s', currentGame, games[currentGame].gameId));
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Team for this game is %s', games[currentGame].teamId));
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Bot for this game is %s', games[currentGame].botId));
        if (BootstrapData.runAllBots) {
            if (BootstrapData.teamId == games[currentGame].teamId && games[currentGame].botId == "" && games[currentGame].gameState < 2) {
                // the given team already has a game in progress, end it!
                logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('Game with ID %s matched our team, terminating it!', games[currentGame].gameId));
                shutdownGame(games[currentGame].gameId, pickMaze);
                gameFound = true; // we found an active game
                break; // assume there could only be one active game...might not be right!
            }
        } else {
            if (BootstrapData.teamId == games[currentGame].teamId &&
                BootstrapData.botData[BootstrapData.singleBotToRun - 1].id == games[currentGame].botId) {
                // the given team already has a game in progress, end it!
                logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('Game with ID %s matched our team, terminating it!', games[currentGame].gameId));
                shutdownGame(games[currentGame].gameId, pickMaze);
                gameFound = true; // we found an active game
                break; // assume there could only be one active game...might not be right!
            }
        }
    }

    if (!gameFound) {
        // we didn't find an active game, so go ahead and create a new one
        logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('No active games found for team %s, picking a maze', BootstrapData.teamId));
        pickMaze();
    }

    logger.debug(__filename, 'ParseActiveGames()', 'Exit Point');
}

// determine the maze to use
function pickMaze(wonLastMaze) {
    logger.debug(__filename, 'pickMaze()', 'Entry Point');
    logger.trace(__filename, 'pickMaze()', UtilJS.format('  wonLastMaze = %s', wonLastMaze));
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.specificMaze: %s', BootstrapData.specificMaze));
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.startAtBeginningOfMazeList: %s', BootstrapData.startAtBeginningOfMazeList));

    if (null != BootstrapData.specificMaze) {
        if (BootstrapData.specificMazeStarted) {
            if (wonLastMaze == true) {
                // we've already run the specific maze, so we're done here!
                logger.info(__filename, 'pickMaze()', 'CONGRATULATIONS - you beat the specific maze!');
                process.exit(0);
            }
        }

        // use the maze specified!
        logger.debug(__filename, 'pickMaze()', UtilJS.format('Using specified maze: %s', BootstrapData.specificMaze));
        BootstrapData.mazeId = BootstrapData.specificMaze;
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        BootstrapData.specificMazeStarted = true;
        createGame();
    } else if (BootstrapData.startAtBeginningOfMazeList) {
        if (wonLastMaze) {
            BootstrapData.currentMaze++; // go back a maze!
        }

        if (BootstrapData.currentMaze >= BootstrapData.mazes.length) {
            // we've run all the mazes so we're done here!
            logger.info(__filename, 'pickMaze()', 'CONGRATULATIONS - you beat all the mazes!');
            process.exit(0);
        }

        // start at mazes[0]
        if (null == BootstrapData.currentMaze) {
            BootstrapData.currentMaze = 0;
        }

        logger.debug(__filename, 'pickMaze()', UtilJS.format('Selected maze #%d: %s', BootstrapData.currentMaze, BootstrapData.mazes[BootstrapData.currentMaze]));
        BootstrapData.mazeId = BootstrapData.mazes[BootstrapData.currentMaze];
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        createGame();
    } else {
        // we've got some work to do...
        logger.trace(__filename, 'pickMaze()', 'Requesting the list of scores from the server for our team');
        req(SCORE_SERVER_URL + '/get?teamId=' + BootstrapData.teamId, function (error, response, body) {
            logger.debug(__filename, 'pickMaze()-callback()', 'Entry Point');

            if (undefined != error) {
                logger.error(__filename, 'pickMaze()-callback()', UtilJS.format('Error getting scores for team: %s', error));
                logger.debug(__filename, 'pickMaze()-callback()', 'ABEND!');
                process.exit(1);
            }

            logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Parsing JSON: %s', body));
            var scores = JSON.parse(body);

            logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Comparing list of %d mazes to list of %d scores.', BootstrapData.mazes.length, scores.length));
            var foundMazeToPlay = false;
            for (var currentMaze = 0; currentMaze < BootstrapData.mazes.length; currentMaze++) {
                logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Searching scores for a WIN on %s', BootstrapData.mazes[currentMaze]));
                var foundScoreForMaze = false;

                for (var currentScore = 0; currentScore < scores.length; currentScore++) {
                    logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Examining: %s', JSON.stringify(scores[currentScore])));
                    if (scores[currentScore].mazeId == BootstrapData.mazes[currentMaze] &&
                        scores[currentScore].gameResult == 6) {
                        logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('A winning score for maze %s has been found!', BootstrapData.mazes[currentMaze]));
                        foundScoreForMaze = true;
                        break; // no need to search any further
                    }
                }

                if (!foundScoreForMaze) {
                    // we've never beaten this maze! use it!
                    logger.debug(__filename, 'pickMaze()-callback()', UtilJS.format('Using this maze: %s', BootstrapData.mazes[currentMaze]));
                    BootstrapData.mazeId = BootstrapData.mazes[currentMaze];
                    foundMazeToPlay = true;
                    break; // we're done here!
                }
            }

            if (!foundMazeToPlay) {
                // we didn't find a maze to launch, we're toast!
                logger.info(__filename, 'pickMaze()-callback()', 'CONGRATULATIONS - you have beat all the games!');
                process.exit(0);
            }

            logger.debug(__filename, 'pickMaze()-callback()', 'Found a maze to play, creating the game!');
            createGame();

            logger.debug(__filename, 'pickMaze()-callback()', 'Exit Point');
        });
    }

    logger.debug(__filename, 'pickMaze()', 'Exit Point');
}

// Create a game
function createGame() {
    logger.debug(__filename, 'createGame()', 'Entry Point');
    logger.trace(__filename, 'createGame()', UtilJS.format('Creating game with:'));
    logger.trace(__filename, 'createGame()', UtilJS.format('  MazeID: %s', BootstrapData.mazeId));
    logger.trace(__filename, 'createGame()', UtilJS.format('  TeamID: %s', BootstrapData.teamId));
    var actionUrl;
    if (!BootstrapData.runAllBots) {
        logger.trace(__filename, 'createGame()', UtilJS.format('  BotID: %s', BootstrapData.botData[BootstrapData.singleBotToRun - 1].id));
        actionUrl = UtilJS.format(GAME_SERVER_URL + '/new/%s/%s/%s/',
            BootstrapData.mazeId, BootstrapData.teamId, BootstrapData.botData[BootstrapData.singleBotToRun - 1].id);
    } else {
        actionUrl = UtilJS.format(GAME_SERVER_URL + '/new/%s/%s/',
            BootstrapData.mazeId, BootstrapData.teamId);
    }

    makePut(actionUrl, function (error, response, body) {
        logger.debug(__filename, 'createGame()-callback()', 'Entry Point');
        if (undefined != error || undefined == body || body.includes("Error creating")) {
            logger.error(__filename, 'createGame()-callback()', 'Error creating game: ' + error + ";" + body);
            logger.debug(__filename, 'createGame()-callback()', 'ABEND!');
            process.exit(1);
        }

        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
        lastActionResult = JSON.parse(body);

        if (lastActionResult.game.gameState != 1) {
            logger.error(__filename, 'createGame()-callback()', 'Error received when creating game:');
            logger.error(__filename, 'createGame()-callback()', JSON.stringify(game));
            process.exit(1);
        }

        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Game URL = %s', lastActionResult.game.url));
        var gameId;
        if (undefined === lastActionResult.game.gameId) {
            gameId = lastActionResult.game.url.substring(game.url.lastIndexOf('/') + 1);
        } else {
            gameId = lastActionResult.game.gameId;
        }
        logger.debug(__filename, 'createGame()-callback()', UtilJS.format('New Game with ID %s created!', gameId));

        if (BootstrapData.launchChrome) {
            require('child_process').exec('start chrome ' + MONITOR_SERVER_URL + '/view/' + gameId);
        }

        logger.debug(__filename, 'createGame()-callback()', 'We\'re ready to play the game!');
        logger.info(__filename, 'createGame()-callback()', 'START THE GAME! (Maze = ' + BootstrapData.mazeId + ')');
        playGame(gameId, lastActionResult);
        logger.debug(__filename, 'createGame()-callback()', 'Exit Point');
    });
    logger.debug(__filename, 'createGame()', 'Exit Point');
}

function SendAction(action) {
    botCommands[g_currentBotRun] = action;
}

var g_actionStack = [];
var g_currentAction = 0;
function pushAction(action) {
    g_actionStack[g_actionStack.length] = action;
}

var botCommands = [];
function playGame(gameId, gameState) {
    logger.debug(__filename, 'playGame()', 'Entry Point');

    // get the timestamp to help throttle
    var playGameStartTS = Date.now();

    logger.trace(__filename, 'playGame()', UtilJS.format('Engram: %s', gameState));

    botCommands = [];
    logger.trace(__filename, 'playGame()', UtilJS.format('Iterating over %d bots', BootstrapData.numberOfBots));
    for (var currentBot = 0; currentBot < BootstrapData.numberOfBots; currentBot++) {
        if (BootstrapData.runAllBots || BootstrapData.singleBotToRun == (currentBot + 1)) {
            logger.trace(__filename, 'playGame()', UtilJS.format('Asking Bot %d for input', currentBot + 1));

            BOT_RAM = CodeCampBots[currentBot].BOT_RAM;
            g_currentBotRun = currentBot;
            // botCommands[currentBot] is populated by SendAction()
            lastActionResult = JSON.parse(JSON.stringify(gameState)); // break object reference!

            // parse out written messages just for this bot
            var newMessageArray = [];
            for (var currentMessage = 0; currentMessage < lastActionResult.action.engram.here.messages.length; currentMessage++) {
                if (lastActionResult.action.engram.here.messages[currentMessage].startsWith("bot" + currentBot + ":")) {
                    newMessageArray[newMessageArray.length] = lastActionResult.action.engram.here.messages[currentMessage];
                }
            }
            lastActionResult.action.engram.here.messages = newMessageArray.length != 0 ? newMessageArray : [""];

            CodeCampBots[currentBot].botFn();
            CodeCampBots[currentBot].BOT_RAM = BOT_RAM;

            if (botCommands[currentBot] == undefined) {
                botCommands[currentBot] = { action: null, direction: null, message: null };
            }

            logger.trace(__filename, 'playGame()', UtilJS.format('Bot %d says:', currentBot + 1));
            logger.trace(__filename, 'playGame()', '  Action: ' + botCommands[currentBot].action);
            logger.trace(__filename, 'playGame()', '  Direction: ' + botCommands[currentBot].direction);
        } else {
            botCommands[currentBot] = { action: null, direction: null, message: null };
        }
    }

    logger.trace(__filename, 'playGame()', UtilJS.format('Weighting results from %d bots', botCommands.length));
    var weightedResults = {
        commands: {},
        directions: {},
    };
    for (var currentBot = 0; currentBot < botCommands.length; currentBot++) {
        logger.trace(__filename, 'playGame()', UtilJS.format('Examining bot #%d', currentBot + 1));
        // handle write messages differently
        if (null != botCommands[currentBot].command && CMDS.WRITE == botCommands[currentBot].command) {
            pushAction({
                gameId: gameId,
                command: CMDS.WRITE,
                message: botCommands[currentBot].message != null ? "bot" + currentBot + ":" + botCommands[currentBot].message : "",
            });
        }
        else {
            //------------------------------------------
            // IGNORE TURN COMMANDS!!!!
            //------------------------------------------
            if (null != botCommands[currentBot].command && CMDS.TURN != botCommands[currentBot].command) {
                logger.trace(__filename, 'playGame()', UtilJS.format('   - weighting action %s', botCommands[currentBot].command));
                if (botCommands[currentBot].command in weightedResults.commands) {
                    weightedResults.commands[botCommands[currentBot].command] += BootstrapData.botData[currentBot].weight / 100;
                } else {
                    weightedResults.commands[botCommands[currentBot].command] = BootstrapData.botData[currentBot].weight / 100;
                }
                logger.trace(__filename, 'playGame()', UtilJS.format('     - result: %f', weightedResults.commands[botCommands[currentBot].command]));
            }
            if (null != botCommands[currentBot].direction) {
                logger.trace(__filename, 'playGame()', UtilJS.format('   - weighting direction %s', botCommands[currentBot].direction));
                if (botCommands[currentBot].direction in weightedResults.directions) {
                    weightedResults.directions[botCommands[currentBot].direction] += BootstrapData.botData[currentBot].weight / 100;
                } else {
                    weightedResults.directions[botCommands[currentBot].direction] = BootstrapData.botData[currentBot].weight / 100;
                }
                logger.trace(__filename, 'playGame()', UtilJS.format('     - result: %f', weightedResults.directions[botCommands[currentBot].direction]));
            }
        }
    }

    logger.trace(__filename, 'playGame()', 'Picking highest score...');
    var winningCommand = {
        command: {
            value: null,
            weight: 0,
        },
        direction: {
            value: null,
            weight: 0,
        },
    };
    logger.trace(__filename, 'playGame()', 'Examining actions to determine winner...');
    for (var action in weightedResults.commands) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Examining "%s" with weight %f', action, weightedResults.commands[action]));
        if (weightedResults.commands[action] > winningCommand.command.weight) {
            logger.trace(__filename, 'playGame()', UtilJS.format('    %s has won at %f weight vs. %s at %f weight',
                action, weightedResults.commands[action], winningCommand.command.value, winningCommand.command.weight
            ));
            winningCommand.command.weight = weightedResults.commands[action];
            winningCommand.command.value = action;
        }
    }
    logger.trace(__filename, 'playGame()', 'Examining directions to determine winner...');
    for (var direction in weightedResults.directions) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Examining "%s" with weight %f', direction, weightedResults.directions[direction]));
        if (weightedResults.directions[direction] > winningCommand.direction.weight) {
            logger.trace(__filename, 'playGame()', UtilJS.format('    %s has won at %f weight vs. %s at %f weight',
                direction, weightedResults.directions[direction], winningCommand.direction.value, winningCommand.direction.weight
            ));
            winningCommand.direction.weight = weightedResults.directions[direction];
            winningCommand.direction.value = direction;
        }
    }

    logger.trace(__filename, 'playGame()', 'Producing cohesion results...');
    var cohesionScores = [];
    for (var currentBot = 0; currentBot < botCommands.length; currentBot++) {
        if (BootstrapData.runAllBots || BootstrapData.singleBotToRun == (currentBot + 1)) {
            if (botCommands[currentBot].command != null || botCommands[currentBot].direction != null) {
                cohesionScores[currentBot] = 0;
            } else {
                cohesionScores[currentBot] = null;
            }

            if (botCommands[currentBot].command == winningCommand.command.value) {
                cohesionScores[currentBot] == null ? cohesionScores[currentBot] = 0.5 : cohesionScores[currentBot] += 0.5;
            }
            if (botCommands[currentBot].direction == winningCommand.direction.value) {
                cohesionScores[currentBot] == null ? cohesionScores[currentBot] = 0.5 : cohesionScores[currentBot] += 0.5;
            }
        } else {
            cohesionScores[currentBot] = 0;
        }
        logger.trace(__filename, 'playGame()', UtilJS.format('  Result for Bot #%d = %f', currentBot + 1, cohesionScores[currentBot]));
    }

    if (null != gameState) {
        // are we dead?
        if (gameState.playerState & PLAYER_STATES.DEAD) {
            logger.info(__filename, 'playGame()-callback()', "YOU HAVE DIED!");
            if (BootstrapData.runAllBots) {
                logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                pickMaze(false);
            }
            return;
        }

        // check to see if we've won!
        logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Iterating over %s outcomes...', gameState.action.outcomes.length));
        for (var currentOutcome = 0; currentOutcome < gameState.action.outcomes.length; currentOutcome++) {
            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Examining outcome #%d: %s', currentOutcome, gameState.action.outcomes[currentOutcome]));
            if (gameState.action.outcomes[currentOutcome].includes("winner")) {
                // we solved the maze!
                logger.info(__filename, 'playGame()-callback()', "MAZE SOLVED!");
                logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                pickMaze(true);
                return;
            }
            if (gameState.action.outcomes[currentOutcome].includes("game is over")) {
                // we're dead, Jim...
                logger.info(__filename, 'playGame()-callback()', "YOU HAVE DIED!");
                logger.trace(__filename, 'playGame()-callback()', 'Trying again...');
                pickMaze(false);
                return;
            }
        }
    }

    var actionPayload = {
        gameId: gameId,
        command: winningCommand.command.value != null ? winningCommand.command.value : CMDS.NONE,
        direction: winningCommand.direction.value != null ? winningCommand.direction.value : DIRS.NONE,
        cohesionScores: cohesionScores,
    };
    pushAction(actionPayload);

    logger.trace(__filename, 'playGame()', 'Making our move!');
    g_currentAction = 0;
    makeReliablePut(GAME_SERVER_URL + '/action/', g_actionStack[g_currentAction++], function playGameCallbackFn(error, response, body) {
        logger.debug(__filename, 'playGame()-callback()', 'Entry Point');
        if (null != error) {
            logger.error(__filename, 'playGame()-callback()', "Error executing action request: " + error);
            shutdownGame(gameId, null);
            logger.debug(__filename, 'playGame()-callback()', 'Aborting game...will shutdown gracefully...');
            return; // don't exit because we need shutdownGame to finish
        }

        if (g_currentAction < g_actionStack.length) {
            makeReliablePut(GAME_SERVER_URL + '/action/', g_actionStack[g_currentAction++], playGameCallbackFn);
            return;
        } else {
            g_actionStack = []; // all done!
        }

        var responseObj = null;
        if (response.statusCode == 400) {
            logger.error(__filename, 'playGame()-callback()', 'Error making move:');
            logger.error(__filename, 'playGame()-callback()', JSON.stringify(body));
        } else {
            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('JSON returned: %s', body));
            responseObj = body;

            // we haven't won, so let's keep playing!
            logger.debug(__filename, 'playGame()-callback()', UtilJS.format('Making move #%d', responseObj.game.score.moveCount + 1));
        }

        // but first make sure we aren't moving TOO fast
        var playGameEndTS = Date.now();
        if (playGameEndTS - playGameStartTS < BootstrapData.minimumCycleTime) {
            // we've gone too fast!
            var delayInMS = BootstrapData.minimumCycleTime - (playGameEndTS - playGameStartTS);
            setTimeout(function () {
                logger.trace(__filename, 'playGame()-callback()', 'Making our next move!');
                playGame(gameId, responseObj);
            }, delayInMS);
        } else {
            logger.trace(__filename, 'playGame()-callback()', 'Making our next move!');
            playGame(gameId, responseObj);
        }

        logger.debug(__filename, 'playGame()-callback()', 'Exit Point');
    });
    logger.debug(__filename, 'playGame()', 'Exit Point');
}

function shutdownGame(gameId, callback) {
    logger.debug(__filename, 'shutdownGame()', 'Entry Point');
    makeDelete(GAME_SERVER_URL + "/abandon/" + gameId, function (error, response, body) {
        logger.trace(__filename, 'shutdownGame()-callback()', 'Callback Entry Point');

        if (null != error) {
            logger.error(__filename, 'shutdownGame()-callback()', "Error aborting game: " + error);
            logger.debug(__filename, 'shutdownGame()-callback()', "ABEND!");
            process.exit(1);
        }

        logger.trace(__filename, 'shutdownGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
        var obj = JSON.parse(body);
        if (obj.gameState != 3) {
            logger.error(__filename, 'shutdownGame()-callback()', 'Could not shutdown game: ' + obj.status);
            logger.debug(__filename, 'shutdownGame()-callback()', "ABEND!");
            process.exit(1);
        }

        if (null != callback) {
            logger.debug(__filename, 'shutdownGame()-callback()', UtilJS.format('Calling %s()...', callback.name));
            callback();
        }
    });
    logger.debug(__filename, 'shutdownGame()', 'Exit Point');
}

function makeRequest(url, callback) {
    logger.debug(__filename, 'makeRequest()', UtilJS.format("Calling %s", url));
    req(url, callback);
}

function makePut(url, callback) {
    logger.debug(__filename, 'makePut()', UtilJS.format("Calling %s", url));
    req.put(url, callback);
}

function makeDelete(url, callback) {
    logger.debug(__filename, 'makePut()', UtilJS.format("Calling %s", url));
    req.delete(url, callback);
}

function makeReliablePost(theUrl, postBody, callback, currentTry) {
    logger.debug(__filename, 'makeReliablePost()', UtilJS.format("Calling %s", theUrl));
    logger.trace(__filename, 'makeReliablePost()', UtilJS.format("  Body: %s", JSON.stringify(postBody)));
    var options = {
        url: theUrl,
        json: postBody,
        timeout: 6000,
        headers: {
            'Content-Type': "application/json",
        },
    };

    req.post(options, function (error, response, body) {
        logger.trace(__filename, 'makeReliablePost()-callback()', 'Entry Point');

        if (null != error && error.code == "ETIMEDOUT") {
            logger.warn(__filename, 'makeReliablePost()-callback()', 'REQUEST TIMED OUT! Trying to recover...');
            if (null == currentTry) {
                currentTry = 1;
            } else {
                currentTry++;
            }

            if (currentTry < 10) {
                logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Attempting try #%d', currentTry));
                makeReliablePost(theUrl, postBody, callback, currentTry);
                return;
            } // if tries are exceeded, TIMEOUT will be passed to the callback() for handling
        }

        logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Calling %s()...', callback.name));
        callback(error, response, body);

        logger.trace(__filename, 'makeReliablePost()-callback()', 'Exit Point');
    });
}

function makeReliablePut(theUrl, postBody, callback, currentTry) {
    logger.debug(__filename, 'makeReliablePost()', UtilJS.format("Calling %s", theUrl));
    logger.trace(__filename, 'makeReliablePost()', UtilJS.format("  Body: %s", JSON.stringify(postBody)));
    var options = {
        url: theUrl,
        json: postBody,
        timeout: 6000,
        headers: {
            'Content-Type': "application/json",
        },
    };

    req.put(options, function (error, response, body) {
        logger.trace(__filename, 'makeReliablePost()-callback()', 'Entry Point');

        if (null != error && error.code == "ETIMEDOUT") {
            logger.warn(__filename, 'makeReliablePost()-callback()', 'REQUEST TIMED OUT! Trying to recover...');
            if (null == currentTry) {
                currentTry = 1;
            } else {
                currentTry++;
            }

            if (currentTry < 10) {
                logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Attempting try #%d', currentTry));
                makeReliablePut(theUrl, postBody, callback, currentTry);
                return;
            } // if tries are exceeded, TIMEOUT will be passed to the callback() for handling
        }

        logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Calling %s()...', callback.name));
        callback(error, response, body);

        logger.trace(__filename, 'makeReliablePost()-callback()', 'Exit Point');
    });
}

function interleaveText(str1, str2) {
    var result = "";
    var currentCharacter;
    var numberOfCharacters = str1.length > str2.length ? str1.length : str2.length;

    for (var currentCharacter = 0; currentCharacter < numberOfCharacters; currentCharacter++) {
        if (currentCharacter < str1.length) {
            result += str1[currentCharacter];
        }
        if (currentCharacter < str2.length) {
            result += str2[currentCharacter];
        }
    }

    return result;
}









// from gameFuncs.js on MazeMasterJS.com
function reformatData(data) {
    const nData = {};
    nData.player = {};

    // clear out some unused data elements
    delete data.action.engram.here.intuition;
    delete data.action.engram.here.items;

    // outcomes
    nData.outcomes = data.action.outcomes;

    // map player data
    nData.player.facing = data.playerFacing;
    nData.player.state = data.playerState;
    nData.player.health = data.action.playerLife;

    // the here engrams
    nData.room = data.action.engram.here;

    nData.see = {};
    nData.see.north = data.action.engram.north.see;
    nData.see.south = data.action.engram.south.see;
    nData.see.east = data.action.engram.east.see;
    nData.see.west = data.action.engram.west.see;

    nData.hear = {};
    nData.hear.north = data.action.engram.north.hear;
    nData.hear.south = data.action.engram.south.hear;
    nData.hear.east = data.action.engram.east.hear;
    nData.hear.west = data.action.engram.west.hear;

    nData.smell = {};
    nData.smell.north = data.action.engram.north.smell;
    nData.smell.south = data.action.engram.south.smell;
    nData.smell.east = data.action.engram.east.smell;
    nData.smell.west = data.action.engram.west.smell;

    nData.touch = {};
    nData.touch.north = data.action.engram.north.feel;
    nData.touch.south = data.action.engram.south.feel;
    nData.touch.east = data.action.engram.east.feel;
    nData.touch.west = data.action.engram.west.feel;

    nData.taste = {};
    nData.taste.north = data.action.engram.north.taste;
    nData.taste.south = data.action.engram.south.taste;
    nData.taste.east = data.action.engram.east.taste;
    nData.taste.west = data.action.engram.west.taste;

    return nData;
}

/**
 * Returns the number of object keys in BOT_RAM
 *
 * @return {number} The number of object keys found in BOT_RAM
 */
const getBotRamLength = () => {
    return Object.keys(BOT_RAM).length;
};

function logMessage() {

}
