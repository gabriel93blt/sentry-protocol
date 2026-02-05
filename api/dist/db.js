"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertAgent = upsertAgent;
exports.getAllAgents = getAllAgents;
exports.getAgentById = getAgentById;
exports.agentExists = agentExists;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    console.log('✅ Supabase connected');
}
else {
    console.warn('⚠️ Supabase credentials not configured - database features disabled');
}
// Create or update agent
async function upsertAgent(agent) {
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }
    try {
        const { error } = await supabase
            .from('agents')
            .upsert({
            ...agent,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'sentry_id'
        });
        if (error)
            throw error;
        return { success: true };
    }
    catch (e) {
        console.error('Supabase upsert error:', e);
        return { success: false, error: e.message };
    }
}
// Get all agents
async function getAllAgents() {
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .order('registered_at', { ascending: false });
        if (error)
            throw error;
        return { success: true, agents: data || [] };
    }
    catch (e) {
        console.error('Supabase getAllAgents error:', e);
        return { success: false, error: e.message };
    }
}
// Get agent by sentry_id
async function getAgentById(sentryId) {
    if (!supabase) {
        return { success: false, error: 'Database not configured' };
    }
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('sentry_id', sentryId)
            .single();
        if (error)
            throw error;
        return { success: true, agent: data };
    }
    catch (e) {
        console.error('Supabase getAgentById error:', e);
        return { success: false, error: e.message };
    }
}
// Check if agent exists
async function agentExists(walletAddress) {
    if (!supabase) {
        return false;
    }
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('id')
            .eq('wallet_address', walletAddress)
            .limit(1);
        if (error)
            throw error;
        return data && data.length > 0;
    }
    catch (e) {
        return false;
    }
}
//# sourceMappingURL=db.js.map