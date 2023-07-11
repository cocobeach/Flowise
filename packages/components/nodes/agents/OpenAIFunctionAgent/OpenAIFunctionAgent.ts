import { ICommonObject, IMessage, INode, INodeData, INodeParams } from '../../../src/Interface'
import { initializeAgentExecutorWithOptions, AgentExecutor } from 'langchain/agents'
import { CustomChainHandler, getBaseClasses } from '../../../src/utils'
import { BaseLanguageModel } from 'langchain/base_language'
import { flatten } from 'lodash'
import { BaseChatMemory, ChatMessageHistory } from 'langchain/memory'
import { AIMessage, HumanMessage } from 'langchain/schema'

class OpenAIFunctionAgent_Agents implements INode {
    label: string
    name: string
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'OpenAI Function Agent'
        this.name = 'openAIFunctionAgent'
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'openai.png'
        this.description = `An agent that uses OpenAI's Function Calling functionality to pick the tool and args to call`
        this.baseClasses = [this.type, ...getBaseClasses(AgentExecutor)]
        this.inputs = [
            {
                label: 'Allowed Tools',
                name: 'tools',
                type: 'Tool',
                list: true
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseChatMemory'
            },
            {
                label: 'OpenAI Chat Model',
                name: 'model',
                description:
                    'Only works with gpt-3.5-turbo-0613 and gpt-4-0613. Refer <a target="_blank" href="https://platform.openai.com/docs/guides/gpt/function-calling">docs</a> for more info',
                type: 'BaseChatModel'
            },
            {
                label: 'System Message',
                name: 'systemMessage',
                type: 'string',
                rows: 4,
                optional: true,
                additionalParams: true
            }
        ]
    }

    async init(nodeData: INodeData): Promise<any> {
        const model = nodeData.inputs?.model as BaseLanguageModel
        const memory = nodeData.inputs?.memory as BaseChatMemory
        const systemMessage = nodeData.inputs?.systemMessage as string

        let tools = nodeData.inputs?.tools
        tools = flatten(tools)

        const executor = await initializeAgentExecutorWithOptions(tools, model, {
            agentType: 'openai-functions',
            verbose: process.env.DEBUG === 'true' ? true : false,
            agentArgs: {
                prefix: systemMessage ?? `You are a helpful AI assistant.`
            }
        })
        if (memory) executor.memory = memory

        return executor
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string> {
        const executor = nodeData.instance as AgentExecutor
        const memory = nodeData.inputs?.memory as BaseChatMemory

        if (options && options.chatHistory) {
            const chatHistory = []
            const histories: IMessage[] = options.chatHistory

            for (const message of histories) {
                if (message.type === 'apiMessage') {
                    chatHistory.push(new AIMessage(message.message))
                } else if (message.type === 'userMessage') {
                    chatHistory.push(new HumanMessage(message.message))
                }
            }
            memory.chatHistory = new ChatMessageHistory(chatHistory)
            executor.memory = memory
        }

        if (options.socketIO && options.socketIOClientId) {
            const handler = new CustomChainHandler(options.socketIO, options.socketIOClientId)
            const result = await executor.run(input, [handler])
            return result
        } else {
            const result = await executor.run(input)
            return result
        }
    }
}

module.exports = { nodeClass: OpenAIFunctionAgent_Agents }