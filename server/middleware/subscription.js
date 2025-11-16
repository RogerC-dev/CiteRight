/**
 * Subscription Middleware
 * Checks if user has active subscription and required features
 */

const database = require('../config/database');
const { asyncHandler } = require('./errorHandler');

/**
 * Check if user has active subscription
 */
async function checkSubscription(req, res, next) {
    if (!database.isConnected()) {
        return res.status(503).json({
            success: false,
            error: 'Database not connected'
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';

        const request = database.getRequest();
        request.input('userId', userId);

        const result = await request.query(`
            SELECT TOP 1
                plan,
                status,
                end_date
            FROM Subscriptions
            WHERE user_id = @userId
            AND status = 'active'
            ORDER BY created_at DESC
        `);

        if (result.recordset.length === 0) {
            req.subscription = {
                hasSubscription: false,
                plan: 'free',
                status: 'active'
            };
            return next();
        }

        const subscription = result.recordset[0];
        const now = new Date();
        const endDate = new Date(subscription.end_date);
        const isActive = subscription.status === 'active' && endDate > now;

        req.subscription = {
            hasSubscription: true,
            plan: subscription.plan,
            status: isActive ? 'active' : 'expired'
        };

        next();
    } catch (error) {
        console.error('Error checking subscription:', error);
        // Continue with free plan on error
        req.subscription = {
            hasSubscription: false,
            plan: 'free',
            status: 'active'
        };
        next();
    }
}

/**
 * Require subscription for route
 */
function requireSubscription(requiredPlan = 'pro') {
    return (req, res, next) => {
        if (!req.subscription) {
            return res.status(401).json({
                success: false,
                error: 'Subscription status not available'
            });
        }

        if (!req.subscription.hasSubscription || req.subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Active subscription required',
                requiredPlan
            });
        }

        const planHierarchy = { free: 0, pro: 1, enterprise: 2 };
        const userPlanLevel = planHierarchy[req.subscription.plan] || 0;
        const requiredPlanLevel = planHierarchy[requiredPlan] || 0;

        if (userPlanLevel < requiredPlanLevel) {
            return res.status(403).json({
                success: false,
                error: `Plan upgrade required. Current: ${req.subscription.plan}, Required: ${requiredPlan}`
            });
        }

        next();
    };
}

/**
 * Check feature access
 */
function checkFeature(featureName) {
    return (req, res, next) => {
        if (!req.subscription) {
            return res.status(401).json({
                success: false,
                error: 'Subscription status not available'
            });
        }

        const features = getPlanFeatures(req.subscription.plan);

        if (!features[featureName]) {
            return res.status(403).json({
                success: false,
                error: `Feature "${featureName}" not available in your plan`,
                requiredPlan: 'pro'
            });
        }

        req.featureAccess = features[featureName];
        next();
    };
}

/**
 * Get plan features
 */
function getPlanFeatures(plan) {
    const plans = {
        free: {
            aiQueries: 5,
            aiQueriesLimit: 5,
            pdfUploads: false,
            advancedSearch: false,
            analytics: false,
            prioritySupport: false
        },
        pro: {
            aiQueries: -1, // unlimited
            aiQueriesLimit: -1,
            pdfUploads: true,
            advancedSearch: true,
            analytics: true,
            prioritySupport: false
        },
        enterprise: {
            aiQueries: -1,
            aiQueriesLimit: -1,
            pdfUploads: true,
            advancedSearch: true,
            analytics: true,
            prioritySupport: true
        }
    };

    return plans[plan] || plans.free;
}

module.exports = {
    checkSubscription,
    requireSubscription,
    checkFeature,
    getPlanFeatures
};

