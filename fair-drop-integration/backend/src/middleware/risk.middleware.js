import {
  trackRequest,
  acquireConcurrency,
  releaseConcurrency,
  evaluateRisk
} from "../services/risk.service.js.js";


export async function riskMiddleware(req, res, next) {
  const userId = req.user?.id;
  const dropId = req.params?.dropId;

  if (!userId || !dropId) {
    return next();
  }


  let concurrencyAcquired = false;

  try {

    // --------------------------------------------------------
    // Track request
    // --------------------------------------------------------

    await trackRequest(
      userId,
      dropId
    );


    // --------------------------------------------------------
    // Check concurrency
    // --------------------------------------------------------

    concurrencyAcquired =
      await acquireConcurrency(
        userId,
        dropId
      );


    if (!concurrencyAcquired) {
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "Too many concurrent requests for this drop"
        }
      });
    }


    // --------------------------------------------------------
    // Evaluate risk
    // --------------------------------------------------------

    const risk = await evaluateRisk(
      userId,
      dropId
    );


    // Attach to request
    req.risk = risk;


    // --------------------------------------------------------
    // BLOCK
    // --------------------------------------------------------

    if (risk.decision === "BLOCK") {
      await releaseConcurrency(
        userId,
        dropId
      );

      concurrencyAcquired = false;

      return res.status(403).json({
        success: false,
        error: {
          code: "REQUEST_BLOCKED",
          message:
            "Request blocked due to suspicious activity"
        },
        data: {
          riskScore: risk.riskScore,
          decision: risk.decision
        }
      });
    }


    // --------------------------------------------------------
    // THROTTLE
    // --------------------------------------------------------

    if (risk.decision === "THROTTLE") {

      res.setHeader(
        "Retry-After",
        "5"
      );

      await releaseConcurrency(
        userId,
        dropId
      );

      concurrencyAcquired = false;

      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "Request rate is too high. Please slow down."
        },
        data: {
          riskScore: risk.riskScore,
          decision: risk.decision
        }
      });
    }


    // --------------------------------------------------------
    // CHALLENGE
    // --------------------------------------------------------

    if (risk.decision === "CHALLENGE") {

      await releaseConcurrency(
        userId,
        dropId
      );

      concurrencyAcquired = false;

      return res.status(403).json({
        success: false,
        error: {
          code: "ABUSE_DETECTED",
          message:
            "Additional verification is required"
        },
        data: {
          riskScore: risk.riskScore,
          decision: risk.decision
        }
      });
    }


    // --------------------------------------------------------
    // RELEASE AFTER REQUEST COMPLETES
    // --------------------------------------------------------

    res.on("finish", async () => {
      if (concurrencyAcquired) {
        await releaseConcurrency(
          userId,
          dropId
        );
      }
    });

    res.on("close", async () => {
      if (concurrencyAcquired) {
        await releaseConcurrency(
          userId,
          dropId
        );
      }
    });


    next();

  } catch (error) {

    if (concurrencyAcquired) {
      await releaseConcurrency(
        userId,
        dropId
      );
    }

    next(error);
  }
}