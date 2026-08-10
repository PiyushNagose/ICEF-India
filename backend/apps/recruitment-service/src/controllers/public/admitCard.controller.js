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

// Public render — no auth needed, uses admitCardId from lookup response
const renderPublicAdmitCardHtml = asyncHandler(async (req, res) => {
  const { htmlToPdfBuffer } = require("../../shared/services/pdf.service");
  const html = await examService.renderAdmitCardHtml(req.params.id, {
    publicAccess: true,
    trackDownload: req.query.embed !== "1",
    embed: req.query.embed === "1",
  });
  if (req.query.pdf === "1") {
    const pdf = await htmlToPdfBuffer(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="admit-card.pdf"`,
    );
    res.setHeader("Content-Length", pdf.length);
    return res.status(StatusCodes.OK).send(pdf);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(StatusCodes.OK).send(html);
});

module.exports = {
  lookupAdmitCard,
  verifyAdmitCard,
  renderPublicAdmitCardHtml,
};
