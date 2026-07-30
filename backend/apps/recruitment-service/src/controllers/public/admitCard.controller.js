const { StatusCodes } = require("http-status-codes");
const examService = require("../../shared/services/exam.service");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");

const lookupAdmitCard = asyncHandler(async (req, res) => {
  const result = await examService.lookupPublicAdmitCard(req.body);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit card found", result));
});

const verifyAdmitCard = asyncHandler(async (req, res) => {
  const result = await examService.verifyAdmitCard(req.params.token);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit card verified", result));
});

module.exports = {
  lookupAdmitCard,
  verifyAdmitCard,
};
