import neo4j from 'neo4j-driver'

export const createGraphDriver = async () => {
    // URI examples: 'neo4j://localhost', 'neo4j+s://xxx.databases.neo4j.io'
    const URI = process.env.NEO4J_URI!
    const USER = process.env.NEO4J_USERNAME!
    const PASSWORD = process.env.NEO4J_PASSWORD!
    let driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD))
    const serverInfo = await driver.getServerInfo()
    console.log('Connection established')
    console.log(serverInfo)

    // Use the driver to run queries

    await driver.close()
}