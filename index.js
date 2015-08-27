var __ = require('highland');

var fs = require('fs');
var uuid = require('node-uuid');
var queryStringParser = require('querystring');

var http = require('http');
var server = http.createServer();

var PORT = 3000;
server.listen(PORT, function () {
  console.log("Server listening on: http://localhost:%s", PORT);
});

function onlyGET(reqRes) {
  return reqRes.req.method === 'GET';
}

function onlyPOST(reqRes) {
  return reqRes.req.method === 'POST';
}

function onlyPUT(reqRes) {
  return reqRes.req.method === 'PUT';
}

function createBoardRoute(reqRes) {
  return reqRes.req.url === '/boards';
}

function createBoard(reqRes) {
  var board = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  reqRes.req.board = board;
  return reqRes;
}

function appendBoardToFile(reqRes) {
  return __(function (push, next) {
    var boardId = uuid.v1();
    fs.appendFile('boards.txt', boardId + ' ' + JSON.stringify(reqRes.req.board) + '\n', function (error) {
      reqRes.req.boardId = boardId;
      reqRes.req.statusCode = 201;
      push(error, reqRes);
      push(null, __.nil);
    });
  });
}

function parsePathParam(path, name, reqRes) {
  var route = reqRes.req.url;
  var token;
  route.replace(
    new RegExp(path),
    function ($0, $1, $2, $3) {
      token = $1;
    }
  );

  reqRes.req[name] = token;
  return reqRes;
}

function readFile(fileName, reqRes) {
  return __.wrapCallback(fs.readFile)(fileName, {
      encoding: 'utf8'
    })
    .map(function (text) {
      reqRes.req.boards = text;
      return reqRes;
    });
}

function findBoard(reqRes) {
  var boards = reqRes.req.boards,
    boardId = reqRes.req.boardId,
    board;

  boards.replace(
    new RegExp(boardId + ' (.*)'),
    function ($0, $1, $2, $3) {
      board = $1;
    }
  );

  if(board) {
    var tokens = board.split(' ');
    board = tokens[0];
    var gameStatus = tokens[1];

    reqRes.req.board = JSON.parse(board);
    reqRes.req.statusCode = 200;

    if(parseInt(gameStatus) == 0) {
      reqRes.req.tie = true;
    } else if(gameStatus > 0) {
      reqRes.req.winner = gameStatus;
    }

    return reqRes;
  } else {
    reqRes.req.statusCode = 404;
    reqRes.req.errorMessage = 'Board not found!!!';

    var error = new Error(reqRes.req.errorMessage);
    error.reqRes = reqRes;

    throw error;
  }
}

function parseFormParams(reqRes) {
  reqRes.req.setEncoding('utf8');
  return __(function (push, next) {
    reqRes.req.once('data', function (data) {
      reqRes.req.body = queryStringParser.parse(data);
      push(null, reqRes);
      push(null, __.nil);
    });
  });
}

function validateMove(reqRes) {
  var body = reqRes.req.body;
  var row = body.row;
  var col = body.col;
  var player = body.p;
  var board = reqRes.req.board;

  if(row >= 3 || row < 0 || col >= 3 || col < 0 || player >= 3 || player <= 0 || board[row][col] != 0) {
    reqRes.req.statusCode = 400;
    reqRes.req.errorMessage = 'Invalid move!!!';

    var error = new Error(reqRes.req.errorMessage);
    error.reqRes = reqRes;

    throw error;
  }

  return reqRes;
}

function updateBoard(reqRes) {
  var board = reqRes.req.board;
  var body = reqRes.req.body;
  var row = body.row;
  var col = body.col;
  var player = body.p;

  board[row][col] = parseInt(player);

  return reqRes;
}

function endGame(reqRes) {
  var board = reqRes.req.board;
  var row = reqRes.req.body.row;
  var col = reqRes.req.body.col;

  function checkHorizontal(board, row) {
    var firstCell = board[row][0];
    var won = true;
    for(var c = 1; c < 3; c++) {
      if(board[row][c] != firstCell) {
        won = false;
        break;
      }
    }

    if(won) return firstCell;
    else return 0;
  }

  function checkVertical(board, col) {
    var firstCell = board[0][col];
    var won = true;
    for(var r = 1; r < 3; r++) {
      if(board[r][col] != firstCell) {
        won = false;
        break;
      }
    }

    if(won) return firstCell;
    else return 0;
  }

  function checkLRDiagonal(board) {
    var firstCell = board[0][0];
    var won = true;
    for(var r = 1; r < 3; r++) {
      if(board[r][r] != firstCell) {
        won = false;
        break;
      }
    }

    if(won) return firstCell;
    else return 0;
  }

  function checkRLDiagonal(board) {
    var firstCell = board[0][2];
    var won = true;
    for(var r = 1; r < 3; r++) {
      if(board[r][2 - r] != firstCell) {
        won = false;
        break;
      }
    }

    if(won) return firstCell;
    else return 0;
  }

  function checkTie(board) {
    var draw = true;
    for(var r = 0; r < 3; r++) {
      for(var c = 0; c < 3; c++) {
        if(board[r][c] === 0) {
          draw = false;
          break;
        }
      }
    }

    return draw;
  }

  var winner = checkHorizontal(board, row) || checkVertical(board, col) || checkLRDiagonal(board) || checkRLDiagonal(board);
  if(winner > 0) {
    reqRes.req.winner = winner;
  } else if(checkTie(board)) {
    reqRes.req.tie = true;
  }

  return reqRes;
}

var writeFile = __.wrapCallback(fs.writeFile);

function saveBoard(reqRes) {
  var boardId = reqRes.req.boardId;

  function updateBoardRow(r) {
    var tokens = r.split(' ', 2);
    if(tokens[0] === boardId) {
      var line = boardId + ' ' + JSON.stringify(reqRes.req.board);
      
      if(reqRes.req.winner > 0) line += ' ' + reqRes.req.winner;
      else if(reqRes.req.tie) line += ' ' + reqRes.req.tie;

      return line;
    } else {
      return r;
    }
  }

  var boardList = reqRes.req.boards.split('\n');
  return __(boardList)
    .map(updateBoardRow)
    .reduce('', function (acc, row) {
      if(row.trim() != '')
        return acc + row + '\n';
      return acc;
    })
    .flatMap(function (text) {
      return writeFile('boards.txt', text);
    })
    .map(function () {
      return reqRes;
    });

}

function sendResponse(reqRes) {
  reqRes.res.writeHead(reqRes.req.statusCode || 500, {
    "Content-Type": "application/json"
  });

  reqRes.res.end(JSON.stringify({
    boardId: reqRes.req.boardId,
    board: reqRes.req.board,
    errorMessage: reqRes.req.errorMessage,
    gameStatus: {
      winner: reqRes.req.winner,
      tie: reqRes.req.tie,
    }
  }));
}

function errorHandler(error, push) {
  switch(error.message) {
    case 'Board not found!!!':
      push(null, error.reqRes);
      break;
    case 'Invalid move!!!':
      push(null, error.reqRes);
      break;
    default:
      push(error);
      break;
  }
}

var stream = __('request', server, ['req', 'res']);

stream.fork()
  .filter(onlyGET)
  .map(__.curry(parsePathParam)('boards/([^/]*)')('boardId'))
  .map(__.curry(readFile)('boards.txt'))
  .sequence()
  .map(findBoard)
  .errors(errorHandler)
  .each(sendResponse);

stream.fork()
  .filter(onlyPOST)
  .fork()
  .filter(createBoardRoute)
  .map(createBoard)
  .map(appendBoardToFile)
  .sequence()
  .each(sendResponse);

stream.fork()
  .filter(onlyPUT)
  .map(__.curry(parsePathParam)('boards/([^/]*)')('boardId'))
  .flatMap(parseFormParams)
  .map(__.curry(readFile)('boards.txt'))
  .sequence()
  .map(findBoard)
  .map(validateMove)
  .map(updateBoard)
  .map(endGame)
  .flatMap(saveBoard)
  .errors(errorHandler)
  .each(sendResponse);
