import {sendToDB} from "./request.js"
import {randint, shuffle, range} from "./utils.js";
import {GUI} from "./gui.js";


export class ChoiceManager {
    /*
    Manage trials with 2 options
    Private methods are prefixed with _
     */
    constructor({
                    exp,
                    trialObj,
                    imgObj,
                    sessionNum,
                    phaseNum,
                    feedbackDuration,
                    completeFeedback,
                    showFeedback,
                    elicitationType,
                    conditionObj,
                    feedbackObj,
                    maxTrials,
                    nextFunc,
                    nextParams
                } = {}) {

        // members
        this.exp = exp;

        this.trialObj = trialObj;
        this.feedbackObj = feedbackObj;
        this.imgObj = imgObj;

        this.sessionNum = sessionNum;
        this.phaseNum = phaseNum;

        this.feedbackDuration = feedbackDuration;
        this.completeFeedback = completeFeedback;
        this.beforeFeedbackDuration = this.exp.beforeFeedbackDuration;
        this.showFeedback = showFeedback;
        this.elicitationType = elicitationType;

        this.nextFunc = nextFunc;
        this.nextParams = nextParams;

        if (elicitationType === -1) {
            this.conditionObj = conditionObj;
        }

        // initGameStageDiv non parametric variables
        this.trialNum = 0;

        if (!maxTrials) {
            this.nTrial = trialObj.length;
        } else {
            this.nTrial = maxTrials;
        }

        this.invertedPosition = shuffle(
            Array.from(Array(this.nTrial), x => randint(0, 1))
        );

        if (this.exp.isTesting) {
            this._isTesting();
        }

        this.skip = undefined;
        this.skipEnabled = true;

    }

    /* =================== public methods ================== */

    run() {

        GUI.initGameStageDiv();

        this.skipEnabled = true;

        let trialObj = this.trialObj[this.trialNum];

        let presentationTime = (new Date()).getTime();

        let condition = -1;

        if (this.elicitationType === -1) {
            condition = this.conditionObj[this.trialNum];
        }

        let params = {
            stimIdx1: trialObj[0], // key in img dict
            stimIdx2: trialObj[1],
            contIdx1: trialObj[2],
            contIdx2: trialObj[3],
            p1: trialObj[4],
            p2: trialObj[5],
            ev1: trialObj[6],
            ev2: trialObj[7],
            r1: trialObj[8],
            r2: trialObj[9],
            isCatchTrial: trialObj[10],
            option1Type: trialObj[11],
            option2Type: trialObj[12],
            presentationTime: presentationTime,
            condition: condition
        };

        GUI.displayOptions(
            params["stimIdx1"],
            params["stimIdx2"],
            this.imgObj,
            this.feedbackObj,
            this.invertedPosition[this.trialNum]
        );

        let clickEnabled = true;

        $('#canvas1').click({obj: this}, function (event) {
            if (!clickEnabled)
                return;
            clickEnabled = false;
            event.data.obj.skipEnabled = false;
            this.style.borderColor = "black";
            event.data.obj._clickEvent(1, params);
        });

        $('#canvas2').click({obj: this}, function (event) {
            if (!clickEnabled)
                return;
            clickEnabled = false;
            event.data.obj.skipEnabled = false;
            this.style.borderColor = "black";
            event.data.obj._clickEvent(2, params);
        });

    };


    /* =================== private methods ================== */
    _isTesting() {
        GUI.insertSkipButton(this, this.nTrial, this.trialNum);
    }

    _clickEvent(choice, params) {

        let choiceTime = (new Date()).getTime();
        let reactionTime = choiceTime - params["presentationTime"];
        let invertedPosition = this.invertedPosition[this.trialNum];
        let leftRight =
            +((invertedPosition && (choice === 1)) || (!invertedPosition && (choice === 2)));

        let option1Type = params['option1Type'];
        let option2Type = params['option2Type'];

        let isCatchTrial = +(params['isCatchTrial']);

        let condition = params['condition'];

        let contIdx1 = params["contIdx1"];
        let contIdx2 = params["contIdx2"];

        let p1 = params['p1'];
        let p2 = params['p2'];

        let symL;
        let symR;

        if (!invertedPosition) {
            symL = params['stimIdx1'];
            symR = params['stimIdx2'];
        } else {
            symL = params['stimIdx2'];
            symR = params['stimIdx1'];
        }

        let [reward1, reward2, thisReward, otherReward, correctChoice] = this._getReward(choice, params);
        this._showReward(reward1, reward2, thisReward, choice);

        if (this.exp.online) {
            sendToDB(0,
                {
                    exp: this.exp.expName,
                    expID: this.exp.expID,
                    id: this.exp.subID,
                    test: +(this.exp.isTesting),
                    trial: this.trialNum,
                    elicitation_type: this.elicitationType,
                    cont_idx_1: contIdx1,
                    cont_idx_2: contIdx2,
                    condition: condition,
                    symL: symL, // sym left filename
                    symR: symR, // sym right filename
                    choice: choice,
                    correct_choice: correctChoice,
                    outcome: thisReward,
                    cf_outcome: otherReward,
                    choice_left_right: leftRight,
                    reaction_time: reactionTime,
                    reward: this.exp.totalReward,
                    session: this.sessionNum,
                    p1: p1[1],
                    p2: p2[1],
                    option1: option1Type,
                    option2: option2Type,
                    ev1: Math.round(params["ev1"] * 100) / 100,
                    ev2: Math.round(params["ev2"] * 100) / 100,
                    iscatch: isCatchTrial,
                    inverted: invertedPosition,
                    choice_time: choiceTime - this.exp.initTime,
                    elic_distance: -1,
                    p_lottery: -1
                },
                'php/InsertLearningDataDB.php'
            );
        }

        setTimeout(function (event) {
            event.obj.next()
        }, this.feedbackDuration + this.beforeFeedbackDuration * (+(this.showFeedback)), {obj: this});
    }

    _getReward(choice, params) {

        let p1 = params["p1"];
        let p2 = params["p2"];
        let ev1 = params["ev1"];
        let ev2 = params["ev2"];

        let r1 = params["r1"];
        let r2 = params["r2"];

        ev1 = Math.round(ev1 * 100) / 100;
        ev2 = Math.round(ev2 * 100) / 100;

        let reward1;
        let reward2;
        let thisReward;
        let otherReward;
        let correctChoice;

        reward1 = r1[+(Math.random() < p1[1])];
        reward2 = r2[+(Math.random() < p2[1])];
        thisReward = [reward2, reward1][+(choice === 1)];
        otherReward = [reward1, reward2][+(choice === 1)];
        correctChoice = [+(ev2 >= ev1), +(ev1 >= ev2)][+(choice === 1)];

        this.exp.sumReward[this.phaseNum] += thisReward;

        // if session is not training add to total reward
        this.exp.totalReward += thisReward * !([-1, -2].includes(this.sessionNum));

        return [reward1, reward2, thisReward, otherReward, correctChoice];

    };

    _showReward(reward1, reward2, thisReward, choice) {
        GUI.showFeedback({
            completeFeedback: this.completeFeedback,
            showFeedback: this.showFeedback,
            feedbackDuration: this.feedbackDuration,
            beforeFeedbackDuration: this.exp.beforeFeedbackDuration,
            feedbackObj: this.feedbackObj,
            choice: choice,
            thisReward: thisReward,
            reward1: reward1,
            reward2: reward2
        });
    }

    next(nTrial = undefined) {
        if (nTrial !== undefined) {
            GUI.hideOptions();
            this.trialNum = nTrial;
            setTimeout(function (event) {
                if (nTrial === event.obj.nTrial) {
                    event.obj.next();
                } else {
                    event.obj.run();
                }
            }, 500, {obj: this});
            return;
        }
        this.trialNum++;
        if (this.trialNum < this.nTrial) {
            GUI.hideOptions();
            setTimeout(function (event) {
                event.obj.run();
            }, 500, {obj: this});
        } else {
            GUI.hideSkipButton();
            $('#TextBoxDiv').fadeOut(500);
            setTimeout(function (event) {
                $('#Stage').empty();
                GUI.panelShow();
                event.obj.nextFunc(event.obj.nextParams);
            }, 500, {obj: this});
        }
    };
}


export class SliderManager {

    constructor({
                    exp,
                    trialObj,
                    imgObj,
                    sessionNum,
                    phaseNum,
                    feedbackDuration,
                    elicitationType,
                    nextFunc,
                    nextParams
                } = {}) {
        // members
        this.exp = exp;
        this.trialObj = trialObj;
        this.nTrial = trialObj.length;

        this.sessionNum = sessionNum;
        this.phaseNum = phaseNum;

        this.imgObj = imgObj;
        this.trialNum = 0;

        this.invertedPosition = shuffle(
            Array.from(Array(this.nTrial), x => randint(0, 1))
        );

        this.feedbackDuration = feedbackDuration;

        this.elicitationType = elicitationType;

        this.nextFunc = nextFunc;
        this.nextParams = nextParams;

        if (this.exp.isTesting) {
            this._isTesting();
        }
        this.skip = undefined;
        this.skipEnabled = true;
    }

    /* =================== public methods ================== */

    run() {

        GUI.initGameStageDiv();

        this.skipEnabled = true;

        let trialObj = this.trialObj[this.trialNum];

        let presentationTime = (new Date()).getTime();

        let params = {
            stimIdx: trialObj[0],
            contIdx: trialObj[1],
            p1: trialObj[2],
            ev1: trialObj[3],
            r1: trialObj[4],
            isCatchTrial: trialObj[5],
            option1Type: trialObj[6],
            option2Type: trialObj[7],
            presentationTime: presentationTime
        };


        let initValue = range(25, 75, 5)[Math.floor(Math.random() * 10)];
        let clickEnabled = true;

        let slider = GUI.displayOptionSlider(params['stimIdx'], this.imgObj, initValue);

        GUI.listenOnSlider({obj: this, slider: slider}, function (event) {
            if (clickEnabled) {
                clickEnabled = false;
                event.data.obj.skipEnabled = false;
                let choice = slider.value;
                event.data.obj._clickEvent(choice, params);
            }
        });

    };

    /* =================== private methods ================== */
    _isTesting() {
        GUI.insertSkipButton(this, this.nTrial, this.trialNum);
    }

    _clickEvent(choice, params) {

        let choiceTime = (new Date()).getTime();
        let reactionTime = choiceTime - params["presentationTime"];
        let invertedPosition = this.invertedPosition[this.trialNum];
        let ev1 = params["ev1"];
        let p1 = params["p1"][1];
        let contIdx = params['contIdx'];
        let stimIdx = params['stimIdx'];
        let isCatchTrial = +(params["isCatchTrial"]);
        let option1Type = params['option1Type'];

        let [correctChoice, thisReward,
            otherReward, pLottery, elicDistance] = this._getReward(choice, params);

        if (this.exp.online) {
            sendToDB(0,
                {
                    exp: this.exp.expName,
                    expID: this.exp.expID,
                    id: this.exp.subID,
                    test: +(this.exp.isTesting),
                    trial: this.trialNum,
                    elicitation_type: this.elicitationType,
                    cont_idx_1: contIdx,
                    cont_idx_2: -1,
                    condition: -1,
                    symL: stimIdx,
                    symR: -1,
                    choice: choice,
                    correct_choice: correctChoice,
                    outcome: thisReward,
                    cf_outcome: otherReward,
                    choice_left_right: -1,
                    reaction_time: reactionTime,
                    reward: this.exp.totalReward,
                    session: this.sessionNum,
                    p1: p1,
                    p2: -1,
                    option1: option1Type,
                    option2: -1,
                    ev1: Math.round(ev1 * 100) / 100,
                    ev2: -1,
                    iscatch: isCatchTrial,
                    inverted: invertedPosition,
                    choice_time: choiceTime - this.exp.initTime,
                    elic_distance: elicDistance,
                    p_lottery: pLottery
                },
                'php/InsertLearningDataDB.php'
            );
        }

        this.next();

    }

    _getReward(choice, params) {

        let p1 = params["p1"];
        let r1 = params["r1"];
        let thisReward = undefined;

        let pLottery = Math.random().toFixed(2);
        if (pLottery < (choice / 100)) {
            thisReward = r1[+(Math.random() < p1[1])];
        } else {
            thisReward = r1[+(Math.random() < pLottery)]
        }
        let otherReward = -1;

        let correctChoice = +((choice / 100) === p1[1]);
        let elicDistance = Math.abs(choice - p1[1] * 100);

        this.exp.sumReward[this.phaseNum] += thisReward;

        this.exp.totalReward += thisReward * !([-1, -2].includes(this.sessionNum));

        return [correctChoice, thisReward, otherReward, pLottery, elicDistance]

    };

    next(nTrial = undefined) {
        if (nTrial !== undefined) {
            GUI.hideOptions();
            this.trialNum = nTrial;
            setTimeout(function (event) {
                if (nTrial === event.obj.nTrial) {
                    event.obj.next();
                } else {
                    event.obj.run();
                }
            }, 500, {obj: this});
            return;
        }
        this.trialNum++;
        if (this.trialNum < this.nTrial) {
            setTimeout(function (event) {
                GUI.hideOptions();
                setTimeout(function (event) {
                    event.obj.run();
                }, 500, {obj: event.obj});
            }, this.feedbackDuration, {obj: this});
        } else {
            GUI.hideSkipButton();
            setTimeout(function (event) {
                    $('#TextBoxDiv').fadeOut(500);
                    setTimeout(function (event) {
                        $('#Stage').empty();
                        $('#Bottom').empty();
                        event.obj.nextFunc(event.obj.nextParams);
                    }, 500, {obj: event.obj})
                }, this.feedbackDuration, {obj: this}
            );
        }
    };
}
