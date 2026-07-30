const { StatusCodes } = require("http-status-codes");
const examService = require("../../shared/services/exam.service");
const { htmlToPdfBuffer } = require("../../shared/services/pdf.service");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");

const getMyAdmitCards = asyncHandler(async (req, res) => {
  const admitCards = await examService.getCandidateAdmitCards(req.user.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit cards fetched", { admitCards }));
});

const renderMyAdmitCardHtml = asyncHandler(async (req, res) => {
  const html = await examService.renderAdmitCardHtml(req.params.id, {
    candidateId: req.user.id,
    embed: req.query.embed === "1" || req.query.embed === "true",
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(StatusCodes.OK).send(html);
});

const downloadMyAdmitCardPdf = asyncHandler(async (req, res) => {
  const html = await examService.renderAdmitCardHtml(req.params.id, {
    candidateId: req.user.id,
  });
  const pdf = await htmlToPdfBuffer(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="admit-card-${req.params.id}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.status(StatusCodes.OK).send(pdf);
});

module.exports = {
  getMyAdmitCards,
  renderMyAdmitCardHtml,
  downloadMyAdmitCardPdf,
};
