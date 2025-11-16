const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/subscription/status:
 *   get:
 *     summary: Get subscription status
 *     description: Get current user's subscription status
 *     responses:
 *       200:
 *         description: Subscription status retrieved
 *       500:
 *         description: Server error
 */
router.get('/status', asyncHandler(async (req, res) => {
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
                id,
                user_id,
                plan,
                status,
                start_date,
                end_date,
                auto_renew,
                created_at
            FROM Subscriptions
            WHERE user_id = @userId
            ORDER BY created_at DESC
        `);

        if (result.recordset.length === 0) {
            return res.json({
                success: true,
                data: {
                    hasSubscription: false,
                    plan: 'free',
                    status: 'active',
                    features: {
                        aiQueries: 5,
                        aiQueriesLimit: 5,
                        pdfUploads: false,
                        advancedSearch: false,
                        analytics: false
                    }
                }
            });
        }

        const subscription = result.recordset[0];
        const now = new Date();
        const endDate = new Date(subscription.end_date);
        const isActive = subscription.status === 'active' && endDate > now;

        // Get plan features
        const features = getPlanFeatures(subscription.plan);

        res.json({
            success: true,
            data: {
                hasSubscription: true,
                plan: subscription.plan,
                status: isActive ? 'active' : 'expired',
                startDate: subscription.start_date,
                endDate: subscription.end_date,
                autoRenew: subscription.auto_renew,
                features
            }
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscription status',
            message: error.message
        });
    }
}));

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

/**
 * @swagger
 * /api/subscription/create:
 *   post:
 *     summary: Create subscription
 *     description: Create a new subscription for the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *               - paymentMethodId
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [pro, enterprise]
 *               paymentMethodId:
 *                 type: string
 *               autoRenew:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Subscription created successfully
 *       500:
 *         description: Server error
 */
router.post('/create', asyncHandler(async (req, res) => {
    const { plan, paymentMethodId, autoRenew = true } = req.body;
    
    if (!plan || !['pro', 'enterprise'].includes(plan)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid plan. Must be "pro" or "enterprise"'
        });
    }

    if (!paymentMethodId) {
        return res.status(400).json({
            success: false,
            error: 'Payment method ID is required'
        });
    }

    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        
        // TODO: Process payment with Stripe/PayPal
        // For now, we'll just create the subscription record
        // In production, you would:
        // 1. Create payment intent with Stripe/PayPal
        // 2. Verify payment
        // 3. Then create subscription

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

        const request = database.getRequest();
        request.input('userId', userId);
        request.input('plan', plan);
        request.input('status', 'active');
        request.input('startDate', startDate);
        request.input('endDate', endDate);
        request.input('autoRenew', autoRenew);
        request.input('paymentMethodId', paymentMethodId);

        const result = await request.query(`
            INSERT INTO Subscriptions 
                (user_id, plan, status, start_date, end_date, auto_renew, payment_method_id, created_at)
            OUTPUT INSERTED.id, INSERTED.created_at
            VALUES 
                (@userId, @plan, @status, @startDate, @endDate, @autoRenew, @paymentMethodId, GETDATE())
        `);

        res.json({
            success: true,
            data: {
                subscriptionId: result.recordset[0].id,
                plan,
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                autoRenew
            }
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create subscription',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/subscription/cancel:
 *   post:
 *     summary: Cancel subscription
 *     description: Cancel the user's current subscription
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       500:
 *         description: Server error
 */
router.post('/cancel', asyncHandler(async (req, res) => {
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
        
        await request.query(`
            UPDATE Subscriptions
            SET status = 'cancelled',
                auto_renew = 0,
                updated_at = GETDATE()
            WHERE user_id = @userId
            AND status = 'active'
        `);

        res.json({
            success: true,
            message: 'Subscription cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel subscription',
            message: error.message
        });
    }
}));

module.exports = router;

